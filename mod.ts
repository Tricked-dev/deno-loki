import { RangeOf } from './rangeof.ts';

type Entry = [string, string];

interface Body {
	streams: [
		{
			stream: Record<string, string>;
			values: Entry[];
		}
	];
}

/**
 *  Loki logger
 *  @param url  path is where LokiLogger will post to
 *  @param buffer  is the amount of entries to cache before sending
 *  @param labels Labels to use
 *  @param mode mode to post
 */
export class LokiLogger {
	toReport?: Entry[];
	constructor(
		public url: string = 'http://localhost:3100',
		public buffer: RangeOf<50> = 1,
		public labels: Record<string, string> = {
			host: 'localhost',
			job: 'Deno!',
		},
		public mode: 'JSON' | 'TEXT' = 'TEXT'
	) {
		if (buffer !== 1) {
			this.toReport = [];
		}
	}
	private async pushPayload(entry: Entry) {
		if (this.buffer !== 1) this.toReport!.push(entry);
		if (this.buffer === this.toReport?.length) {
			await this.report(this.createPayload(this.toReport));
			//Clear the reports
			this.toReport.length = 0;
		} else if (this.buffer === 1) {
			await this.report(this.createPayload([entry]));
		}
	}
	private createPayload(entries: Entry[]): Body {
		return {
			streams: [{ stream: this.labels, values: entries }],
		};
	}
	private async report(body: Body) {
		//https://github.com/grafana/loki/issues/173
		//https://github.com/sleleko/devops-kb/blob/master/python/push-to-loki.py
		let r = await fetch(`${this.url}/loki/api/v1/push`, {
			headers: { 'Content-type': 'application/json' },
			method: 'POST',
			body: JSON.stringify(body),
		});
		if (!r.ok) {
			throw new Error(
				`FAILED TO POST DATA ${await r.text()} ${JSON.stringify(r)}`
			);
		}
	}

	public log(label: string, text: string, meta?: Record<string, string>) {
		meta = {
			label,
			text,
			...meta,
		};
		return this.pushPayload([
			`${Date.now()}000000`,
			this.mode == 'JSON'
				? JSON.stringify(meta)
				: Object.entries(meta)
						.map(([k, v]) => `${k}="${v}"`)
						.join(' '),
		]);
	}

	public info(text: string, meta?: Record<string, string>) {
		return this.log('INFO', text, meta);
	}
	public warm(text: string, meta?: Record<string, string>) {
		return this.log('WARN', text, meta);
	}
	public error(text: string, meta?: Record<string, string>) {
		return this.log('WARN', text, meta);
	}
	public debug(text: string, meta?: Record<string, string>) {
		return this.log('WARN', text, meta);
	}
}
