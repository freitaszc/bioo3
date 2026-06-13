import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password === "change-me") {
    throw new Error("Set ADMIN_PASSWORD in server/.env before running the seed.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: {
      username,
      passwordHash,
      firstName: "Admin",
      secondName: "",
      email: null
    }
  });

  console.log(`Seeded admin user: ${username}`);

  const videosPath = path.resolve(__dirname, "../../../Web/json/videos.json");
  if (fs.existsSync(videosPath)) {
    const videos = JSON.parse(fs.readFileSync(videosPath, "utf8"));
    for (const [index, video] of videos.entries()) {
      if (!video?.title || !video?.playback_id) continue;
      await prisma.video.upsert({
        where: { playbackId: video.playback_id },
        update: {
          title: video.title,
          pdf: video.pdf || null,
          order: index
        },
        create: {
          title: video.title,
          playbackId: video.playback_id,
          pdf: video.pdf || null,
          order: index
        }
      });
    }
    console.log(`Seeded ${videos.length} videos.`);
  }

  const doctorsPath = path.resolve(__dirname, "../../../Web/json/doctors.json");
  const doctorIdMap = new Map();
  if (fs.existsSync(doctorsPath)) {
    const doctors = JSON.parse(fs.readFileSync(doctorsPath, "utf8"));
    for (const doctor of doctors) {
      const name = String(doctor?.name || "").trim();
      if (!name) continue;
      const record = await prisma.doctor.upsert({
        where: { name },
        update: { phone: String(doctor?.phone || "") },
        create: { name, phone: String(doctor?.phone || "") }
      });
      doctorIdMap.set(Number(doctor.id), record.id);
    }
    console.log(`Seeded ${doctors.length} doctors.`);
  }

  const patientsPath = path.resolve(__dirname, "../../../Web/json/patients.json");
  const consultsPath = path.resolve(__dirname, "../../../Web/json/consults.json");
  if (fs.existsSync(patientsPath)) {
    const patients = JSON.parse(fs.readFileSync(patientsPath, "utf8"));
    const consults = fs.existsSync(consultsPath)
      ? JSON.parse(fs.readFileSync(consultsPath, "utf8"))
      : {};

    for (const patient of patients) {
      const name = String(patient?.name || "").trim();
      const age = Number(patient?.age);
      if (!name || !Number.isInteger(age)) continue;

      const record = await prisma.patient.upsert({
        where: { id: Number(patient.id) },
        update: {
          name,
          age,
          cpf: String(patient?.cpf || ""),
          gender: String(patient?.gender || ""),
          phone: String(patient?.phone || ""),
          status: String(patient?.status || "Ativo"),
          prescription: String(patient?.prescription || ""),
          doctorId: doctorIdMap.get(Number(patient?.doctor)) || null
        },
        create: {
          id: Number(patient.id),
          name,
          age,
          cpf: String(patient?.cpf || ""),
          gender: String(patient?.gender || ""),
          phone: String(patient?.phone || ""),
          status: String(patient?.status || "Ativo"),
          prescription: String(patient?.prescription || ""),
          doctorId: doctorIdMap.get(Number(patient?.doctor)) || null
        }
      });

      const existingConsults = await prisma.consultation.count({ where: { patientId: record.id } });
      if (existingConsults === 0) {
        const notes = consults[String(patient.id)] || [];
        for (const note of notes) {
          await prisma.consultation.create({
            data: {
              patientId: record.id,
              notes: String(note || "")
            }
          });
        }
      }
    }
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Patient"', 'id'), COALESCE((SELECT MAX("id") FROM "Patient"), 1), true)`;
    console.log(`Seeded ${patients.length} patients.`);
  }

  const productsPath = path.resolve(__dirname, "../../../Web/json/products.json");
  if (fs.existsSync(productsPath)) {
    const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
    for (const product of products) {
      const name = String(product?.name || "").trim();
      if (!name) continue;

      await prisma.product.upsert({
        where: { id: Number(product.id) },
        update: {
          name,
          quantity: Number(product?.quantity || 0),
          minStock: Number(product?.min_stock || product?.minStock || 5),
          purchasePrice: Number(product?.purchase_price || product?.purchasePrice || 0),
          salePrice: Number(product?.sale_price || product?.salePrice || 0),
          status: String(product?.status || "Ativo")
        },
        create: {
          id: Number(product.id),
          name,
          quantity: Number(product?.quantity || 0),
          minStock: Number(product?.min_stock || product?.minStock || 5),
          purchasePrice: Number(product?.purchase_price || product?.purchasePrice || 0),
          salePrice: Number(product?.sale_price || product?.salePrice || 0),
          status: String(product?.status || "Ativo")
        }
      });
    }
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Product"', 'id'), COALESCE((SELECT MAX("id") FROM "Product"), 1), true)`;
    console.log(`Seeded ${products.length} products.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
