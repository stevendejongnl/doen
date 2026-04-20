# Doen secrets — do NOT commit a real copy of this file.
#
# Apply options:
#
#  1) kubectl, out-of-band:
#       kubectl create secret generic doen-secret -n doen \
#         --from-literal=SECRET_KEY='...' \
#         --from-literal=DATABASE_URL='postgresql://...' \
#         --from-literal=SMTP_USER='...' \
#         --from-literal=SMTP_PASSWORD='...'
#
#  2) Copy this file to secret.yaml, fill in values, and `kubectl apply -f secret.yaml`.
#     secret.yaml is gitignored — do not commit real values.
#
#  3) Sealed-secrets / External Secrets Operator if you install one later.
apiVersion: v1
kind: Secret
metadata:
  name: doen-secret
  namespace: doen
type: Opaque
stringData:
  SECRET_KEY: "change-me-in-production"
  DATABASE_URL: "postgresql://doen:change-me@postgres:5432/doen"
  SMTP_USER: ""
  SMTP_PASSWORD: ""
