import { fail } from "@/lib/api";
import { LEGAL_DOCS, isLegalSlug } from "@/legal/registry";
import { renderLegalPdf } from "@/lib/legal/pdf";

/**
 * GET /api/legal/<документ>.pdf — печатная версия (GIMN-029).
 *
 * Собирается по требованию, а не на сборке: документы правятся, и файл,
 * собранный при выкладывании, рано или поздно разошёлся бы с тем, что
 * человек видит на экране. Сборка одного документа занимает доли секунды
 * — кэшировать его на час достаточно, чтобы повторное нажатие не считало
 * заново.
 *
 * Имя файла в заголовке — по-русски, поэтому уходит в filename*=UTF-8''…:
 * обычный filename= допускает только латиницу, и браузер сохранил бы файл
 * с именем из знаков вопроса.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/legal/[document]">,
) {
  const { document } = await params;
  const slug = document.replace(/\.pdf$/i, "");

  if (!document.toLowerCase().endsWith(".pdf") || !isLegalSlug(slug)) {
    return fail("Документ не найден", 404);
  }

  const entry = LEGAL_DOCS[slug];

  try {
    const bytes = await renderLegalPdf(entry.doc);

    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(entry.fileName)}`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("legal pdf failed:", e instanceof Error ? e.message : String(e));
    return fail("Не удалось собрать PDF. Документ можно прочитать в настройках.", 500);
  }
}
