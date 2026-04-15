import { describe, expect, it } from "vitest";
import { SETTING_KEYS, parseNotePresets, serializeNotePresets } from "../src/index.js";

describe("note-presets (happy path)", () => {
	it("parses a valid JSON array of strings", () => {
		const settings = { [SETTING_KEYS.NOTE_PRESETS]: '["Ketçap bol","Acılı","Soğansız"]' };
		expect(parseNotePresets(settings)).toEqual(["Ketçap bol", "Acılı", "Soğansız"]);
	});

	it("returns empty array when key is missing", () => {
		expect(parseNotePresets({})).toEqual([]);
	});

	it("serializes round-trips through parse without drift", () => {
		const input = ["Ketçap bol", "Mayonez", "Sıcak"];
		const serialized = serializeNotePresets(input);
		expect(parseNotePresets(serialized)).toEqual(input);
	});
});

describe("note-presets (sad path)", () => {
	it("returns empty array on invalid JSON", () => {
		const settings = { [SETTING_KEYS.NOTE_PRESETS]: "not-json" };
		expect(parseNotePresets(settings)).toEqual([]);
	});

	it("returns empty array when value is not an array", () => {
		const settings = { [SETTING_KEYS.NOTE_PRESETS]: '{"a":"b"}' };
		expect(parseNotePresets(settings)).toEqual([]);
	});

	it("filters out non-string entries", () => {
		const settings = { [SETTING_KEYS.NOTE_PRESETS]: '["Ketçap",1,null,"Acılı"]' };
		expect(parseNotePresets(settings)).toEqual(["Ketçap", "Acılı"]);
	});
});
