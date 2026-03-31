import { YAML } from "bun";
import { readdir, readFile } from "fs/promises";
import { readFileTool } from "./file";
import { fileURLToPath } from "url";
import { isAbsolute, resolve } from "path";
import z from "zod";
import { tool } from "ai";
interface Sandbox {
    readFile(path: string): Promise<string>;
    readdir(
        path: string,
        opts: { withFileTypes: true },
    ): Promise<{ name: string; isDirectory(): boolean }[]>;
    exec(command: string): Promise<{ stdout: string; stderr: string }>;
}


export interface SkillMetadata {
    name: string;
    description: string;
    path: string;
}

export async function discoverSkills(
    sandbox: Sandbox,
    directories: string[],
): Promise<SkillMetadata[]> {
    const skills: SkillMetadata[] = [];
    const seenNames = new Set<string>();

    async function scanDir(dir: string) {
        let entries;
        try {
            entries = await sandbox.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const skillDir = `${dir}/${entry.name}`;
            const skillFile = `${skillDir}/SKILL.md`;

            try {
                const content = await sandbox.readFile(skillFile);
                const frontmatter = parseFrontmatter(content);
                console.log(`Found skill: ${frontmatter.name} at ${skillFile}`);

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

export function parseFrontmatter(content: string): { name: string; description: string, path?: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match?.[1]) throw new Error('No frontmatter found');
    // Parse YAML using your preferred library
    return YAML.parse(match[1]) as { name: string; description: string, path?: string };
}

const PROJECT_ROOT = process.env.ARC_WORKSPACE_ROOT ?? resolve(fileURLToPath(new URL('../../', import.meta.url)));

const resolvePath = (path: string) => isAbsolute(path) ? path : resolve(PROJECT_ROOT, path);


export const sdbx: Sandbox = {
    exec: async (command) => {
        const proc = Bun.spawn([command]);
        return { stdout: proc.stdout.toString(), stderr: "" };
    },
    readFile: async (path) => {
        const resolvedPath = resolvePath(path);
        const content = await readFile(resolvedPath, "utf-8");
        return content;
    },
    readdir: async (path, opts) => {
        const resolvedPath = resolvePath(path);
        const entries = await readdir(resolvedPath, opts);
        return entries;
    }
}

function buildSkillsPrompt(skills: SkillMetadata[]): string {
    const skillsList = skills
        .map(s => `- ${s.name}: ${s.description}`)
        .join('\n');

    return `
## Skills

Use the \`loadSkill\` tool to load a skill when the user's request
would benefit from specialized instructions.

Available skills:
${skillsList}
`;
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
        const { sandbox, skills } = experimental_context as { sandbox: Sandbox, skills: SkillMetadata[] };
        const skill = skills.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (!skill) {
            return { error: `Skill '${name}' not found` };
        }

        const skillFile = `${skill.path}/SKILL.md`;
        const content = await sandbox.readFile(skillFile);
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
    execute: async (_, { experimental_context }) => {
        const { sandbox } = experimental_context as { sandbox: Sandbox };
        const skills = await discoverSkills(sandbox, ['.agents']);
        return skills.map(s => ({ name: s.name, description: s.description }));
    },
});