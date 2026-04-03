import { useState } from "react";
import { setBaseUrl, getBaseUrl } from "../lib/api";

declare global {
	interface Window {
		electronAPI?: {
			getConfig: () => Promise<{ serverUrl: string }>;
			saveConfig: (config: { serverUrl: string }) => Promise<boolean>;
		};
	}
}

interface ServerConfigProps {
	onConnected: () => void;
}

export function ServerConfig({ onConnected }: ServerConfigProps) {
	const [url, setUrl] = useState(getBaseUrl());
	const [testing, setTesting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleTest = async () => {
		setTesting(true);
		setError(null);

		try {
			const res = await fetch(`${url.replace(/\/$/, "")}/health`);
			const data = await res.json();
			if (data.ok) {
				setBaseUrl(url);
				await window.electronAPI?.saveConfig({ serverUrl: url });
				onConnected();
			} else {
				setError("Sunucu yanıt verdi ama sağlık kontrolü başarısız");
			}
		} catch {
			setError("Sunucuya bağlanılamadı. IP ve port'u kontrol edin.");
		} finally {
			setTesting(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
				<h1 className="text-2xl font-bold mb-2">Sepetarası Kasa</h1>
				<p className="text-gray-500 mb-6">Sunucu adresini girin</p>

				<input
					type="text"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="http://192.168.1.100:3000"
					className="w-full border rounded-lg px-4 py-3 text-lg mb-4"
					onKeyDown={(e) => e.key === "Enter" && handleTest()}
				/>

				{error && <p className="text-red-500 text-sm mb-3">{error}</p>}

				<button
					type="button"
					onClick={handleTest}
					disabled={testing}
					className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-lg
						disabled:opacity-50 transition-colors"
				>
					{testing ? "Bağlanıyor..." : "Bağlan"}
				</button>
			</div>
		</div>
	);
}
