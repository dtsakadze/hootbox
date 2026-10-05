import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className={`btn btn-sm ${copied ? "btn-mint" : "btn-ghost"} ${className}`}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					/* clipboard blocked: user can still select the text */
				}
			}}
		>
			{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
			{copied ? "Copied!" : label}
		</button>
	);
}

export function CodeBlock({ code }: { code: string }) {
	return (
		<div className="relative">
			<pre className="code pr-24">
				<code>{code}</code>
			</pre>
			<CopyButton text={code} className="absolute right-3 top-3" />
		</div>
	);
}
