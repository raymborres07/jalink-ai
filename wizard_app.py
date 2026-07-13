import streamlit as st
import json
import os
from datetime import datetime

DATA_FILE = "data.json"

st.set_page_config(page_title="Synapse Wizard", page_icon="🧙", layout="wide")

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"submissions": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

st.title("🧙 Wizard Panel")
st.caption("You are the AI. Process submissions manually.")
st.divider()

data = load_data()

# ─── Stats ───
pending = [s for s in data["submissions"] if s["status"] == "pending"]
processed = [s for s in data["submissions"] if s["status"] == "processed"]
decided = [s for s in processed if s.get("user_decision")]

col1, col2, col3 = st.columns(3)
col1.metric("Pending", len(pending))
col2.metric("Processed", len(processed))
col3.metric("User Decided", len(decided))

st.divider()

# ─── Pending Queue ───
if not pending:
    st.success("No pending submissions. You're caught up!")
    st.stop()

st.subheader(f"Pending Queue ({len(pending)})")

# Process one at a time
current = pending[0]

st.markdown(f"### Submission: {current['id']}")
st.write(f"**Time:** {current['timestamp'][:19]}")
if current.get("filename"):
    st.write(f"**File:** {current['filename']}")
    # Try to show image
    file_path = current.get("file_path")
    if file_path and os.path.exists(file_path):
        if file_path.lower().endswith((".jpg", ".jpeg", ".png")):
            st.image(file_path, width=400)
        else:
            st.caption(f"File saved at: {file_path}")

if current.get("pasted_text"):
    st.markdown("**Pasted Text:**")
    st.text(current["pasted_text"])

st.divider()
st.markdown("### 📝 Fill in Extraction (This is what the user sees)")

col1, col2 = st.columns(2)

with col1:
    supplier_name = st.text_input("Supplier Name*", key="supplier")
    invoice_number = st.text_input("Invoice Number*", key="invoice")
    po_number = st.text_input("PO Number", key="po")
    
with col2:
    amount = st.text_input("Amount*", key="amount")
    currency = st.selectbox("Currency", ["SGD", "MYR", "IDR", "THB", "VND", "USD"], key="curr")
    date = st.text_input("Date (as written on doc)", key="date")

line_items = st.text_area("Line Items (optional)", key="items", height=80)

st.divider()
st.markdown("### 🔍 Match & Risk (This is your 'AI analysis')")

col1, col2 = st.columns(2)

with col1:
    match_status = st.radio(
        "PO Match Status",
        ["matched", "partial", "no_match"],
        format_func=lambda x: {"matched": "✅ Matched", "partial": "⚠️ Partial", "no_match": "❌ No match"}[x]
    )
    
    flag_reason = st.text_input(
        "Flag Reason (if partial/no match)",
        placeholder="e.g. Quantity mismatch: PO says 500, invoice says 450",
        key="flag"
    )

with col2:
    risk_score = st.slider("Risk Score", 0, 100, 30, key="risk")
    recommendation = st.text_area(
        "Recommendation",
        placeholder="e.g. Approve — small variance within tolerance. Supplier has good history.",
        height=100,
        key="rec"
    )

st.divider()

if st.button("🚀 Publish Result to User", type="primary", use_container_width=True):
    if not supplier_name or not amount:
        st.error("Supplier name and amount are required")
    else:
        # Update the submission
        current["status"] = "processed"
        current["extraction"] = {
            "supplier_name": supplier_name,
            "invoice_number": invoice_number,
            "po_number": po_number,
            "amount": amount,
            "currency": currency,
            "date": date,
            "line_items": line_items
        }
        current["match_status"] = match_status
        current["risk_score"] = risk_score
        current["recommendation"] = recommendation
        current["flag_reason"] = flag_reason
        
        save_data(data)
        st.success("Published! User can now see the result.")
        st.rerun()

# ─── Quick view of processed ───
with st.expander("View all processed submissions"):
    for s in reversed(processed):
        ext = s.get("extraction", {})
        decision = s.get("user_decision", "—")
        st.markdown(
            f"**{ext.get('supplier_name', '?')}** | "
            f"{ext.get('invoice_number', '?')} | "
            f"{ext.get('amount', '?')} {ext.get('currency', '')} | "
            f"Match: {s.get('match_status', '?')} | "
            f"Risk: {s.get('risk_score', '?')} | "
            f"User: **{decision}**"
        )