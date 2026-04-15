import { YAML } from "bun";
import { readdir, readFile } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";
import { resolveWorkspacePath } from "@/utils/workspace";
import { config } from "@/utils/config";

export interface SkillMetadata {
    name: string;
    description: string;
    path: string;
}

export const DEFAULT_SKILL_DIRECTORIES = config.tools.skills.defaultDirectories;

export async function discoverSkills(
    directories: readonly string[] = DEFAULT_SKILL_DIRECTORIES,
): Promise<SkillMetadata[]> {
    const skills: SkillMetadata[] = [];
    const seenNames = new Set<string>();

    async function scanDir(dir: string) {
        let entries;
        try {
            entries = await readdir(resolveWorkspacePath(dir), { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const skillDir = `${dir}/${entry.name}`;
            const skillFile = `${skillDir}/SKILL.md`;

            try {
                const content = await readFile(resolveWorkspacePath(skillFile), "utf-8");
                const frontmatter = parseFrontmatter(content);

                if (!seenNames.has(frontmatter.name)) {
                    seenNames.add(frontmatter.name);
                    skills.push({
                        name: frontmatter.name,
                        description: frontmatter.description,
                        path: skillDir,
                    });
                }
            } catch {
                await scanDir(skillDir);
            }
        }
    }

    for (const dir of directories) {
        await scanDir(dir);
    }

    return skills;
}

function parseFrontmatter(content: string): { name: string; description: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match?.[1]) throw new Error('No frontmatter found');
    return YAML.parse(match[1]) as { name: string; description: string };
}

function stripFrontmatter(content: string): string {
    const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return match ? content.slice(match[0].length).trim() : content.trim();
}

export const loadSkillTool = tool({
    description: "Load a skill by name. Use when the user's request would benefit from specialized instructions. Refer to the 'Skills' section for available skills.",
    inputSchema: z.object({
        name: z.string().describe("The name of the skill to load"),
    }),
    needsApproval: true,
    execute: async ({ name }, { experimental_context }) => {
        const skills = (experimental_context as { skills?: SkillMetadata[] } | undefined)?.skills;
        const availableSkills = skills ?? await discoverSkills();
        const skill = availableSkills.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (!skill) {
            return { error: `Skill '${name}' not found` };
        }

        const skillFile = `${skill.path}/SKILL.md`;
        const content = await readFile(resolveWorkspacePath(skillFile), "utf-8");
        const body = stripFrontmatter(content);

        return {
            skillDirectory: skill.path,
            content: body,
        };
    },
});

export const discoverSkillsTool = tool({
    description: "Discover available skills. Use to get an updated list of skills and their descriptions.",
    inputSchema: z.object({}),
    execute: async () => {
        const skills = await discoverSkills();
        return skills.map(s => ({ name: s.name, description: s.description }));
    },
});
