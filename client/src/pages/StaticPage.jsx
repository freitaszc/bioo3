import { Link } from "react-router-dom";

const content = {
  privacy: {
    title: "Política de Privacidade",
    text: "A BioO3 protege os dados informados na plataforma e usa essas informações apenas para operação do atendimento e dos serviços contratados."
  },
  about: {
    title: "Quem Somos",
    text: "A BioO3 é uma plataforma voltada para gestão de análises, pacientes e operações clínicas com uma experiência simples e objetiva."
  }
};

export default function StaticPage({ type }) {
  const page = content[type] || content.about;

  return (
    <main className="static-page">
      <section className="static-card">
        <img src="/assets/logo.svg" alt="BioO3" />
        <h1>{page.title}</h1>
        <p>{page.text}</p>
        <Link className="primary-button link-button" to="/login">Voltar ao login</Link>
      </section>
    </main>
  );
}

