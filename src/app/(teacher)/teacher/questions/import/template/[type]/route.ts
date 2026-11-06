import { NextResponse } from "next/server";
import writeExcelFile from "write-excel-file/node";
import { requireTeacher } from "@/features/auth/session";
import { getContentType } from "@/features/question-bank/content-types";
import { templateHeaders } from "@/features/question-bank/import";

export async function GET(_: Request, { params }: { params: Promise<{ type: string }> }) {
  await requireTeacher();
  const { type: key } = await params;
  const type = getContentType(key);
  if (!type) return new NextResponse("Not found", { status: 404 });

  const headers = templateHeaders(type);
  const buffer = await writeExcelFile(
    [headers.map((value) => ({ value, fontWeight: "bold" as const }))],
    { columns: headers.map(() => ({ width: 18 })), stickyRowsCount: 1 },
  ).toBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type.key}-template.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
