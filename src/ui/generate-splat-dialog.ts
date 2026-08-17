import { Button, Container } from '@playcanvas/pcui';

import { Events } from '../events';

type JobResponse = { generation_id?: string; status?: string; stage?: string; model_url?: string | null; filename?: string; message?: string; upgrade_url?: string; error?: string };

class GenerateSplatDialog extends Container {
    private abortController: AbortController | null = null;

    constructor(events: Events) {
        super({ id: 'generate-splat-popup', class: 'blocks-shortcuts', hidden: true, tabIndex: -1 });
        const dialog = document.createElement('section');
        dialog.id = 'generate-splat-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'generate-splat-title');
        const eyebrow = document.createElement('p');
        eyebrow.className = 'generate-splat-eyebrow';
        eyebrow.textContent = 'SVG GENIE · AI WORKFLOW';
        const title = document.createElement('h2');
        title.id = 'generate-splat-title';
        title.textContent = 'TEXT TO SPLAT';
        const description = document.createElement('p');
        description.className = 'generate-splat-description';
        description.textContent = 'Describe one object. SVG Genie creates the reference, reconstructs a Gaussian splat, and loads it directly onto this canvas.';
        const textarea = document.createElement('textarea');
        textarea.id = 'generate-splat-prompt';
        textarea.maxLength = 500;
        textarea.rows = 4;
        textarea.placeholder = 'A translucent purple jellyfish desk lamp, product photo...';
        textarea.setAttribute('aria-label', 'Describe the splat to generate');
        const meta = document.createElement('div');
        meta.className = 'generate-splat-meta';
        meta.textContent = '3 CREDITS · USUALLY 20–60 SECONDS · FIRST RUN MAY TAKE LONGER';
        const status = document.createElement('div');
        status.id = 'generate-splat-status';
        status.setAttribute('aria-live', 'polite');
        const actions = document.createElement('div');
        actions.className = 'generate-splat-actions';
        const cancel = new Button({ class: 'generate-splat-cancel', text: 'CANCEL' });
        const generate = new Button({ class: 'generate-splat-submit', text: 'GENERATE & OPEN' });
        actions.append(cancel.dom, generate.dom);
        dialog.append(eyebrow, title, description, textarea, meta, status, actions);
        this.dom.appendChild(dialog);

        const activeJobKey = 'svggenie.text-to-splat.active-job';
        let upgradeUrl: string | undefined;
        let running = false;
        const hide = () => {
            this.abortController?.abort(); this.abortController = null; running = false; this.hidden = true;
            status.textContent = ''; generate.enabled = true; generate.text = 'GENERATE & OPEN'; upgradeUrl = undefined;
        };
        this.dom.addEventListener('click', (event) => {
            if (event.target === this.dom) hide();
        });
        dialog.addEventListener('click', event => event.stopPropagation());
        this.dom.addEventListener('keydown', (event: KeyboardEvent) => {
            event.stopPropagation();
            if (event.key === 'Escape') hide();
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') generate.dom.click();
        });
        cancel.on('click', hide);

        const request = async (url: string, options?: Parameters<typeof fetch>[1]) => {
            const response = await fetch(url, { credentials: 'same-origin', signal: this.abortController?.signal, ...options });
            const data = await response.json().catch(() => ({})) as JobResponse;
            if (!response.ok) {
                const error = new Error(data.message || 'Generation could not continue') as Error & { upgradeUrl?: string };
                error.upgradeUrl = data.upgrade_url;
                throw error;
            }
            return data;
        };
        const delay = () => new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(resolve, 2500);
            this.abortController?.signal.addEventListener('abort', () => {
                window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        });
        const poll = async (id: string) => {
            while (!this.abortController?.signal.aborted) {
                const job = await request(`/api/tools/text-to-splat/${encodeURIComponent(id)}`);
                if (job.status === 'completed' && job.model_url) return job;
                if (job.status === 'failed' || job.status === 'canceled') {
                    localStorage.removeItem(activeJobKey);
                    throw new Error(job.error || 'The splat could not be generated. Your credits were returned.');
                }
                status.textContent = job.stage === 'image' ? 'CREATING THE REFERENCE IMAGE…' : job.stage === 'finalizing' ? 'VALIDATING & SAVING THE PLY…' : 'RECONSTRUCTING THE GAUSSIAN SPLAT…';
                await delay();
            }
            throw new DOMException('Aborted', 'AbortError');
        };

        const runJob = async (id: string) => {
            if (running) return;
            running = true;
            this.abortController = new AbortController(); generate.enabled = false; generate.text = 'GENERATING…'; status.textContent = 'CREATING THE REFERENCE IMAGE…';
            try {
                const completed = await poll(id);
                status.textContent = 'OPENING YOUR SPLAT…';
                await events.invoke('import', [{ filename: completed.filename || 'generated-splat.spz', url: completed.model_url }]);
                localStorage.removeItem(activeJobKey);
                hide();
            } catch (error) {
                running = false;
                if (error instanceof DOMException && error.name === 'AbortError') return;
                const typed = error as Error & { upgradeUrl?: string };
                status.textContent = typed.message.toUpperCase(); generate.enabled = true;
                generate.text = localStorage.getItem(activeJobKey) ? 'RESUME' : typed.upgradeUrl ? 'GET CREDITS' : 'TRY AGAIN';
                upgradeUrl = typed.upgradeUrl;
            }
        };

        generate.on('click', async () => {
            if (upgradeUrl) {
                window.open(upgradeUrl, '_top')?.focus();
                return;
            }
            const activeJob = localStorage.getItem(activeJobKey);
            if (activeJob) {
                await runJob(activeJob);
                return;
            }
            const prompt = textarea.value.trim();
            if (prompt.length < 3) {
                status.textContent = 'DESCRIBE ONE OBJECT FIRST.'; textarea.focus(); return;
            }
            this.abortController = new AbortController(); generate.enabled = false; generate.text = 'GENERATING…'; status.textContent = 'CREATING THE REFERENCE IMAGE…';
            try {
                const started = await request('/api/tools/text-to-splat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
                if (!started.generation_id) throw new Error('The generation did not return a job ID.');
                localStorage.setItem(activeJobKey, started.generation_id);
                this.abortController = null; generate.enabled = true;
                await runJob(started.generation_id);
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                const typed = error as Error & { upgradeUrl?: string };
                status.textContent = typed.message.toUpperCase(); generate.enabled = true;
                generate.text = typed.upgradeUrl ? 'GET CREDITS' : 'TRY AGAIN';
                upgradeUrl = typed.upgradeUrl;
            }
        });
        const show = () => {
            this.hidden = false; textarea.focus();
            const activeJob = localStorage.getItem(activeJobKey);
            if (activeJob) runJob(activeJob);
        };
        events.on('show.generateSplat', show);
    }
}

export { GenerateSplatDialog };
