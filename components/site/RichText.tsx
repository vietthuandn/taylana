// Hiển thị đoạn chữ admin soạn: giữ xuống dòng, tự biến link thành link bấm được.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className={`whitespace-pre-line ${className}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-violet-500 hover:text-violet-600">{p}</a>
        ) : (
          p
        ),
      )}
    </p>
  );
}
