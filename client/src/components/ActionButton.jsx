const labels = {
  edit: "Editar",
  delete: "Excluir"
};

function Icon({ action }) {
  if (action === "delete") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.2 2.2 0 0 0-3.1-3.1L4 16.5Z" /><path d="m14.8 5.8 3.4 3.4" /></svg>;
}

export default function ActionButton({ action, children, iconOnly = false, className = "", ...props }) {
  const label = children || labels[action] || "Ação";
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`action-button action-${action}${iconOnly ? " action-icon-only" : ""}${className ? ` ${className}` : ""}`}
      aria-label={props["aria-label"] || label}
      title={props.title || label}
    >
      <Icon action={action} />
      <span className={iconOnly ? "sr-only" : ""}>{label}</span>
    </button>
  );
}
