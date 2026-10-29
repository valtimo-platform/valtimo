/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Shared Carbon-ish inline styles for the three sample task-form bundles. Kept in one module so the
// three demos (Level 0 / 1 / 2) look identical and only differ in *how they submit*.

import type {CSSProperties} from "react";

export const rootStyle: CSSProperties = {fontFamily: "IBM Plex Sans, sans-serif"};

export const panelStyle: CSSProperties = {
  border: "1px solid #e0e0e0",
  padding: "16px",
  marginBottom: "16px",
  background: "#ffffff",
};

export const panelTitleStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#161616",
  marginBottom: "4px",
};

export const mutedStyle: CSSProperties = {color: "#6f6f6f", fontSize: "14px"};
export const errorStyle: CSSProperties = {color: "#da1e28", fontSize: "14px", marginTop: "8px"};
export const fieldErrorStyle: CSSProperties = {color: "#da1e28", fontSize: "12px", marginTop: "4px"};
export const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontSize: "12px",
  color: "#525252",
};
export const radioLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "14px",
  color: "#393939",
  marginBottom: "4px",
};

export const textareaStyle: CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontSize: "14px",
  border: "1px solid #8d8d8d",
  backgroundColor: "#f4f4f4",
  outline: "none",
  boxSizing: "border-box",
  minHeight: "80px",
  resize: "vertical",
  fontFamily: "IBM Plex Sans, sans-serif",
};

export const buttonStyle: CSSProperties = {
  padding: "10px 24px",
  fontSize: "14px",
  border: "none",
  background: "#0f62fe",
  color: "#ffffff",
  cursor: "pointer",
};

export const buttonDisabledStyle: CSSProperties = {
  ...buttonStyle,
  background: "#8d8d8d",
  cursor: "not-allowed",
};

export type Decision = "approve" | "reject";
