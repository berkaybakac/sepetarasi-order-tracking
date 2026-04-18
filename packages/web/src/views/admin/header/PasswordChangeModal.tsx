import { PASSWORD_MIN_LENGTH } from "@sepetarasi/shared";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { LockIcon } from "../../../components/icons";
import { useActionFeedback } from "../../../hooks/useActionFeedback";
import { ApiError, api } from "../../../lib/api";
import { Field, InlineAlert, Modal, PasswordInput } from "../ui/primitives";

interface PasswordChangeModalProps {
	open: boolean;
	onClose: () => void;
}

function getPasswordChangeErrorMessage(error: unknown) {
	if (error instanceof ApiError) {
		switch (error.code) {
			case "INVALID_CURRENT_PASSWORD":
				return "Mevcut parola hatalı.";
			case "PASSWORD_REUSE_NOT_ALLOWED":
				return "Yeni parola mevcut parola ile aynı olamaz.";
			case "UNAUTHORIZED":
				return "Oturum süreniz dolmuş. Tekrar giriş yapın.";
			default:
				break;
		}
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Parola değiştirilemedi. Lütfen tekrar deneyin.";
}

export function PasswordChangeModal({ open, onClose }: PasswordChangeModalProps) {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const feedback = useActionFeedback();
	const submitDisabled =
		feedback.isPending ||
		currentPassword.length === 0 ||
		newPassword.length === 0 ||
		confirmPassword.length === 0;

	const updateField =
		(setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
			if (feedback.isError) {
				feedback.reset();
			}
			setter(event.target.value);
		};

	const { reset, isSuccess } = feedback;

	useEffect(() => {
		if (!open) return;
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
		reset();
	}, [open, reset]);

	useEffect(() => {
		if (!isSuccess) return;
		const timeoutId = window.setTimeout(onClose, 900);
		return () => window.clearTimeout(timeoutId);
	}, [isSuccess, onClose]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (newPassword.length < PASSWORD_MIN_LENGTH) {
			feedback.setError(
				new Error(`Yeni parola en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır.`),
				"Yeni parola geçersiz.",
			);
			return;
		}

		if (newPassword !== confirmPassword) {
			feedback.setError(new Error("Yeni parola tekrar alanı eşleşmiyor."), "Parolalar eşleşmiyor.");
			return;
		}

		if (currentPassword === newPassword) {
			feedback.setError(
				new Error("Yeni parola mevcut parola ile aynı olamaz."),
				"Yeni parola mevcut parola ile aynı olamaz.",
			);
			return;
		}

		feedback.setPending();
		try {
			await api.authChangePassword(currentPassword, newPassword);
			feedback.setSuccess("Parolanız güncellendi.");
		} catch (error) {
			const message = getPasswordChangeErrorMessage(error);
			feedback.setError(new Error(message), message);
		}
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Güvenlik Ayarları"
			description="Yönetici parolasını güncelleyin. Yeni parola hemen geçerli olur, bu oturum açık kalır."
		>
			<form className="space-y-4" onSubmit={handleSubmit}>
				<div className="flex items-start gap-3 rounded-[1rem] border border-border-subtle bg-white/[0.03] p-4">
					<span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle bg-white/6 text-brand-primary">
						<LockIcon className="h-4 w-4" />
					</span>
					<div>
						<p className="text-sm font-semibold text-text-strong">Yönetici erişimi korunur</p>
						<p className="mt-1 text-sm text-text-subtle">
							En az {PASSWORD_MIN_LENGTH} karakter kullanın. Yeni parolayı iki kez girerek yazım
							hatasını önleyin.
						</p>
					</div>
				</div>

				{feedback.message && feedback.isError ? (
					<InlineAlert tone="danger">{feedback.message}</InlineAlert>
				) : null}
				{feedback.message && feedback.isSuccess ? (
					<InlineAlert tone="success">{feedback.message}</InlineAlert>
				) : null}

				<Field htmlFor="current-password" label="Mevcut Parola">
					<PasswordInput
						id="current-password"
						data-autofocus
						value={currentPassword}
						onChange={updateField(setCurrentPassword)}
						autoComplete="current-password"
						placeholder="Şu anki parolanızı girin"
						required
					/>
				</Field>

				<Field
					htmlFor="new-password"
					label="Yeni Parola"
					hint={`En az ${PASSWORD_MIN_LENGTH} karakter girin.`}
				>
					<PasswordInput
						id="new-password"
						value={newPassword}
						onChange={updateField(setNewPassword)}
						autoComplete="new-password"
						placeholder="Yeni parolayı girin"
						minLength={PASSWORD_MIN_LENGTH}
						required
					/>
				</Field>

				<Field
					htmlFor="confirm-password"
					label="Yeni Parola Tekrar"
					hint="Yeni parolayı aynı şekilde bir kez daha girin."
				>
					<PasswordInput
						id="confirm-password"
						value={confirmPassword}
						onChange={updateField(setConfirmPassword)}
						autoComplete="new-password"
						placeholder="Yeni parolayı tekrar girin"
						minLength={PASSWORD_MIN_LENGTH}
						required
					/>
				</Field>

				<div className="flex items-center justify-end gap-3 pt-2">
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold text-text-muted hover:text-text-strong"
					>
						Vazgeç
					</button>
					<button
						type="submit"
						disabled={submitDisabled}
						className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-r from-brand-primary to-brand-accent-strong px-4 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(14,165,233,0.25)] disabled:opacity-45"
					>
						{feedback.isPending ? (
							<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : null}
						{feedback.isSuccess ? "Güncellendi" : "Parolayı Güncelle"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
