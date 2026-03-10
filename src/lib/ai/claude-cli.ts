import { spawn } from 'child_process';
import type { AIProvider } from './types';

function callCLI(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let child;

    try {
      child = spawn('claude', ['--print'], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      return reject(new Error('Claude CLI not found. Ensure Claude Code is installed and in PATH.'));
    }

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error('Claude CLI not found. Install Claude Code to use your subscription.'));
      } else {
        reject(new Error(`Claude CLI error: ${err.message}`));
      }
    });

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}${stderr ? ': ' + stderr.slice(0, 300) : ''}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export function createClaudeCliProvider(): AIProvider {
  return {
    async analyze(text: string, systemPrompt: string): Promise<string> {
      const prompt = `<system>\n${systemPrompt}\n</system>\n\nHuman: ${text}`;
      return callCLI(prompt);
    },

    async generate(systemPrompt: string, userPrompt: string): Promise<string> {
      const prompt = `<system>\n${systemPrompt}\n</system>\n\nHuman: ${userPrompt}`;
      return callCLI(prompt);
    },

    async ocr(): Promise<string> {
      throw new Error('Claude CLI does not support image input. Please use an API provider for OCR.');
    },
  };
}
