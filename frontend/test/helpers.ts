import { LitElement } from 'lit';

export type Constructor<T> = new (...args: unknown[]) => T;

/** Mount a Lit element string in the document and wait for first render. */
export async function mount<T extends LitElement>(
  tag: string,
  props: Record<string, unknown> = {},
): Promise<T> {
  const el = document.createElement(tag) as T;
  for (const [k, v] of Object.entries(props)) {
    (el as unknown as Record<string, unknown>)[k] = v;
  }
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** Query inside shadow DOM, throws if not found. */
export function $(el: LitElement, selector: string): Element {
  const found = el.shadowRoot?.querySelector(selector);
  if (!found) throw new Error(`"${selector}" not found in ${el.tagName} shadow DOM`);
  return found;
}

/** Query all inside shadow DOM. */
export function $$(el: LitElement, selector: string): Element[] {
  return Array.from(el.shadowRoot?.querySelectorAll(selector) ?? []);
}

/** Fire a DOM event and wait for the element to update. */
export async function fire(el: LitElement, target: Element | null, eventName: string, init: EventInit = {}): Promise<void> {
  const node = target ?? el;
  node.dispatchEvent(new Event(eventName, { bubbles: true, ...init }));
  await el.updateComplete;
}

/** Set input value and dispatch 'input' event. */
export async function setInputValue(el: LitElement, input: HTMLInputElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
}

/** Click an element and wait for update. */
export async function click(el: LitElement, target: Element): Promise<void> {
  (target as HTMLElement).click();
  await el.updateComplete;
}

/** Remove element from document. */
export function unmount(el: Element): void {
  el.remove();
}

/** Flush all pending microtasks/promises. */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
