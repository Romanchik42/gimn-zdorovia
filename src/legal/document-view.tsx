import {
  CONTACT,
  DRAFT_NOTICE,
  LAUNCH_DATE_PLACEHOLDER,
  OWNER_PLACEHOLDER,
  REQUISITES_PLACEHOLDER,
  type LegalBlock,
  type LegalDoc,
} from "@/legal/document";

/**
 * Разметка юридического документа (GIMN-027).
 *
 * Отделена от текста намеренно: текст — это данные (@/legal/document и
 * файлы документов рядом), и по тем же данным собирается печатная версия.
 * Пока разметка и текст лежали в одном файле с JSX, текст был недоступен
 * ничему, кроме React, — в том числе проверкам и сборщику PDF.
 */

/** Плашка о том, что документ — проект, а не действующая редакция. */
export function DraftNotice() {
  return (
    <p className="rounded-lg border border-info-border bg-info p-3 text-sm text-info-foreground">
      {DRAFT_NOTICE}
    </p>
  );
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <article className="space-y-4">
      <DraftNotice />

      <header className="space-y-1">
        <h3 className="text-base font-semibold">{doc.title}</h3>
        <p className="text-sm text-muted-foreground">{doc.lead}</p>
      </header>

      {doc.clauses.map((clause, i) => (
        <section key={clause.title} className="space-y-2">
          <h4 className="font-medium">
            {i + 1}. {clause.title}
          </h4>
          {clause.blocks.map((block, j) => (
            <Block key={j} block={block} />
          ))}
        </section>
      ))}

      <footer className="space-y-1 border-t border-foreground/10 pt-3 text-sm text-muted-foreground">
        <p>
          {OWNER_PLACEHOLDER}. Реквизиты {REQUISITES_PLACEHOLDER}.
        </p>
        <p>Связь: форма отзыва в приложении или бот {CONTACT}.</p>
        <p>Дата вступления в силу: {LAUNCH_DATE_PLACEHOLDER}.</p>
      </footer>
    </article>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "p") return <p className="text-sm leading-relaxed">{block.text}</p>;

  if (block.kind === "list") {
    return (
      <ul className="space-y-1 text-sm leading-relaxed">
        {block.items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-muted-foreground">
              —
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-foreground/10">
            {block.head.map((cell) => (
              <th key={cell} className="py-1 pr-3 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-foreground/5 align-top">
              {row.map((cell, i) => (
                <td key={i} className="py-1 pr-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
