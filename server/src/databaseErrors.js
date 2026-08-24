export function knownDatabaseError(error) {
  if (error?.code === "P2003") {
    return {
      status: 409,
      message: "Este registro possui dados históricos vinculados e não pode ser excluído. Inative-o quando essa opção estiver disponível."
    };
  }
  if (error?.code === "P2002") {
    return { status: 409, message: "Já existe um registro com estes dados." };
  }
  if (error?.code === "P2025") {
    return { status: 404, message: "Registro não encontrado." };
  }
  return null;
}
