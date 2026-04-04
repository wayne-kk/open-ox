import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface SkillMeta {
  id: string;
  label: string;
  description: string;
}

export async function GET() {
  const skillsDir = path.join(process.cwd(), "public", "skills");

  if (!fs.existsSync(skillsDir)) {
    return NextResponse.json([]);
  }

  const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));

  const skills: SkillMeta[] = files.map((file) => {
    const id = file.replace(".md", "");
    const raw = fs.readFileSync(path.join(skillsDir, file), "utf-8");
    const { data, content } = matter(raw);

    // Extract first heading as label, first paragraph as description
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const label = (data.label as string) ?? headingMatch?.[1] ?? id;

    const descMatch = content.match(/^(?!#)(.{10,120})/m);
    const description = (data.description as string) ?? descMatch?.[1]?.trim() ?? "";

    return { id, label, description };
  });

  return NextResponse.json(skills);
}
