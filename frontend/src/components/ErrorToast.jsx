export default function ErrorToast({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="error-toast" role="alert">
      <span>{message}</span>
      <button type="button" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
