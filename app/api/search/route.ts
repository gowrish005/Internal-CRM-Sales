import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.length < 2) return NextResponse.json({ contacts: [], branches: [], leads: [], tasks: [] });

  const [contacts, leads, tasks] = await Promise.all([
    prisma.contact.findMany({
      where: {
        isArchived: false,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          { designation: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, designation: true, email: true, company: true },
      take: 5,
    }),
    prisma.lead.findMany({
      where: {
        isArchived: false,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { owner: { name: { contains: q, mode: "insensitive" } } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
          { college: { contains: q, mode: "insensitive" } },
          { usn: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, status: true },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        isArchived: false,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { owner: { name: { contains: q, mode: "insensitive" } } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, status: true },
      take: 5,
    }),
  ]);

  return NextResponse.json({ contacts, leads, tasks });
}
