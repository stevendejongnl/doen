{{- define "doen.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "doen.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{ include "doen.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "doen.selectorLabels" -}}
app.kubernetes.io/name: doen
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
