import { LitElement, html } from 'lit';
import { DayscheduleEditorCardConfig } from '../types/custom-types';
import { HomeAssistant } from 'custom-card-helpers';
import { EDITOR_NAME } from '../const/element-names';
import { WEEKDAYS } from '../const/days';

export class DayscheduleEditorCardEditor extends LitElement {
	private _config?: DayscheduleEditorCardConfig;
	private _hass?: HomeAssistant;

	public setConfig(config: DayscheduleEditorCardConfig): void {
		this._config = { ...config };
	}

	public set hass(hass: HomeAssistant) {
		this._hass = hass;
		this.requestUpdate();
	}

	protected render() {
		if (!this._hass || !this._config) return html``;

		return html`
			<div class="card-config">
				${WEEKDAYS.map(
					(day) => html`
						<ha-entity-picker
							.label="${day}"
							.hass=${this._hass}
							.value=${this._config?.entities[day] || ''}
							.configValue=${'entities.' + day}
							.includeDomains=${['input_text']}
							@value-changed=${this._valueChanged}
						></ha-entity-picker>
					`
				)}
			</div>
		`;
	}

	private _valueChanged(ev: CustomEvent): void {
		if (!this._config) return;

		const target = ev.target as any;
		const [section, key] = target.configValue.split('.');

		if (!this._config[section]) {
			this._config[section] = {};
		}

		this._config[section][key] = ev.detail.value;

		const event = new CustomEvent('config-changed', {
			detail: { config: this._config },
			bubbles: true,
			composed: true,
		});
		this.dispatchEvent(event);
	}

	static get styles() {
		return [
			// ...existing styles...
		];
	}
}

// Register element
customElements.get(EDITOR_NAME) ||
	customElements.define(EDITOR_NAME, DayscheduleEditorCardEditor);
(window as any).DayscheduleEditorCardEditor = DayscheduleEditorCardEditor;

// declare types
declare global {
	interface HTMLElementTagNameMap {
		[EDITOR_NAME]: DayscheduleEditorCardEditor;
	}
}
