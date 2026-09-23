/**
 * Каркас юридического документа (GIMN-027).
 *
 * Текст лежит данными, а не вёрсткой: так его проще вычитывать, отдавать
 * юристу и печатать. Плейсхолдер даты намеренно оставлен в тексте — его
 * заменяет владелец перед запуском платного режима, и пока он на месте,
 * видно, что документ не финальный.
 */

/**
 * Владелец назван обезличенно (GIMN-028). ФИО, ИНН и адрес в публичном
 * тексте не стоят: документы лежат в открытом репозитории и видны любому
 * пользователю, а реквизиты физического лица — это его персональные данные.
 * До запуска платного режима их всё равно определяет юрист вместе с формой
 * регистрации (самозанятость или ИП), поэтому сейчас их просто нет.
 */
export const OWNER_PLACEHOLDER = "Владелец приложения «Гимн.здоровья»";

/** Чем заменяются реквизиты, пока их нет. */
export const REQUISITES_PLACEHOLDER = "будут указаны в актуальной редакции документа";
export const LAUNCH_DATE_PLACEHOLDER = "[ДАТА_ЗАПУСКА]";
export const CONTACT = "@gimn_zdorovia_bot";
export const APP_NAME = "Гимн.здоровья";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type LegalClause = {
  title: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  title: string;
  /** Одна строка под заголовком: что это и для кого. */
  lead: string;
  clauses: LegalClause[];
};

/** Плашка о том, что документ — проект, а не действующая редакция. */
export function DraftNotice() {
  return (
    <p className="rounded-lg border border-info-border bg-info p-3 text-sm text-info-foreground">
      Проект документа. Не вступил в силу и не согласован с юристом. Реквизиты Владельца
      и дата вступления в силу {LAUNCH_DATE_PLACEHOLDER} будут указаны в актуальной редакции.
      Опубликован заранее, чтобы во время тестового периода было видно, на каких условиях
      планируется работа.
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
