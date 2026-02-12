#!/bin/bash

NAMESPACE="monolith"

echo "=== Monolith App Status Monitor ==="
echo ""

# 1. Check Deployment status
echo "[Deployment Status]"
kubectl get deployment -n "$NAMESPACE" -o wide
echo ""

# 2. Check Pod status
echo "[Pod Status]"
kubectl get pods -n "$NAMESPACE" -o wide
echo ""

# 3. Check Service status
echo "[Service Status]"
kubectl get svc -n "$NAMESPACE" -o wide
echo ""

# 4. Check endpoints
echo "[Endpoints]"
kubectl get endpoints -n "$NAMESPACE"
echo ""

# 5. Health check from host
echo "[Health Check - Host]"
if curl -s --connect-timeout 5 http://localhost:8000/health > /dev/null 2>&1; then
    echo "Host health check: OK"
    curl -s http://localhost:8000/health | head -c 200
    echo ""
else
    echo "Host health check: FAILED (service may not be ready)"
fi
echo ""

# 6. Health check from cluster
echo "[Health Check - Cluster Internal]"
kubectl run curl-test --rm -i --restart=Never --image=curlimages/curl --timeout=30s -- \
    curl -s --connect-timeout 5 http://monolith-service.monolith.svc.cluster.local:8000/health 2>/dev/null || echo "Cluster internal check completed"
echo ""

# 7. Recent pod logs
echo "[Recent Pod Logs]"
POD_NAME=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$POD_NAME" ]; then
    kubectl logs "$POD_NAME" -n "$NAMESPACE" --tail=20
else
    echo "No pods found"
fi
