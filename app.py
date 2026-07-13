import streamlit as st
import json
import os
from datetime import datetime
import uuid

DATA_FILE = "data.json"

st.set_page_config(page_title="Synapse", page_icon="⚡", layout="centered")

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"submissions": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# ─── Header ───
st.title("⚡ Synapse")
st.caption("Invoice reconciliation for your procurement")
st.divider()

data = load_data()

# ─── Tab 1: Submit ───
tab_submit, tab_history = st.tabs(["Submit Invoice", "History"])

with tab_submit:
    st.subheader("Upload Invoice / Delivery Note / PO")
    
    input_method = st.radio("How do you want to submit?", ["Upload file", "Paste text"], horizontal=True)
    
    uploaded_file = None
    pasted_text = None
    
    if input_method == "Upload file":
        uploaded_file = st.file_uploader(
            "Drop invoice image or PDF here", 
            type=["jpg", "jpeg", "png", "pdf"],
            label_visibility="collapsed"
        )
    else:
        pasted_text = st.text_area(
            "Paste WhatsApp message, email, or invoice text",
            height=150,
            placeholder="e.g. Hi, attached invoice INV-2024-0892 for IDR 45,000,000 from PT Steel Indonesia..."
        )
    
    submitted = st.button("Submit for Processing", type="primary", use_container_width=True)
    
    if submitted:
        if not uploaded_file and not pasted_text:
            st.error("Please upload a file or paste text")
        else:
            # Create submission
            submission = {
                "id": f"sub_{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now().isoformat(),
                "filename": uploaded_file.name if uploaded_file else None,
                "pasted_text": pasted_text,
                "status": "pending",  # pending → processed
                "extraction": None,
                "match_status": None,
                "risk_score": None,
                "recommendation": None,
                "flag_reason": None,
                "user_decision": None
            }
            
            # Save uploaded file to folder
            if uploaded_file:
                os.makedirs("uploads", exist_ok=True)
                file_path = f"uploads/{submission['id']}_{uploaded_file.name}"
                with open(file_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                submission["file_path"] = file_path
            
            data["submissions"].append(submission)
            save_data(data)
            
            st.success("Submitted! Check back in a few minutes for results.")
            st.rerun()

# ─── Tab 2: History ───
with tab_history:
    st.subheader("Recent Submissions")
    
    # Show processed ones first, then pending
    processed = [s for s in data["submissions"] if s["status"] == "processed"]
    pending = [s for s in data["submissions"] if s["status"] == "pending"]
    
    if not data["submissions"]:
        st.info("No submissions yet. Upload your first invoice above.")
    
    # Pending
    if pending:
        st.markdown("### ⏳ Processing")
        for s in reversed(pending):
            with st.expander(f"{s['filename'] or 'Text submission'} — {s['timestamp'][:16]}"):
                if s.get("pasted_text"):
                    st.text(s["pasted_text"][:300])
                st.caption("Still processing...")

    # Processed
    if processed:
        st.markdown("### ✅ Results")
        for s in reversed(processed):
            ext = s.get("extraction", {})
            match = s.get("match_status", "")
            risk = s.get("risk_score")
            rec = s.get("recommendation", "")
            flag = s.get("flag_reason", "")
            decision = s.get("user_decision")
            
            # Status emoji
            if decision == "approved":
                status_emoji = "✅"
            elif decision == "rejected":
                status_emoji = "❌"
            elif decision == "edited":
                status_emoji = "✏️"
            else:
                status_emoji = "⏳"
            
            with st.expander(f"{status_emoji} {ext.get('supplier_name', 'Unknown')} — {ext.get('invoice_number', 'N/A')} — {s['timestamp'][:16]}"):
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("**Extracted Data**")
                    st.write(f"**Supplier:** {ext.get('supplier_name', '—')}")
                    st.write(f"**Invoice:** {ext.get('invoice_number', '—')}")
                    st.write(f"**PO:** {ext.get('po_number', '—')}")
                    st.write(f"**Amount:** {ext.get('amount', '—')} {ext.get('currency', '—')}")
                    st.write(f"**Date:** {ext.get('date', '—')}")
                    if ext.get("line_items"):
                        st.write(f"**Items:** {ext['line_items']}")
                
                with col2:
                    st.markdown("**Analysis**")
                    
                    if match == "matched":
                        st.success("PO matched ✓")
                    elif match == "partial":
                        st.warning(f"Partial match: {flag}")
                    else:
                        st.error(f"No PO match: {flag}")
                    
                    if risk is not None:
                        risk_color = "🟢" if risk < 40 else "🟡" if risk < 70 else "🔴"
                        st.write(f"**Risk:** {risk_color} {risk}/100")
                    
                    if rec:
                        st.info(rec)
                
                # Decision buttons (only if not decided yet)
                if not decision:
                    st.divider()
                    col_a, col_r, col_e = st.columns(3)
                    
                    with col_a:
                        if st.button("✅ Approve", key=f"approve_{s['id']}", use_container_width=True):
                            s["user_decision"] = "approved"
                            save_data(data)
                            st.rerun()
                    
                    with col_r:
                        if st.button("❌ Reject", key=f"reject_{s['id']}", use_container_width=True):
                            s["user_decision"] = "rejected"
                            save_data(data)
                            st.rerun()
                    
                    with col_e:
                        if st.button("✏️ Edit & Approve", key=f"edit_{s['id']}", use_container_width=True):
                            s["user_decision"] = "edited"
                            save_data(data)
                            st.rerun()
                else:
                    st.caption(f"Decision: **{decision.upper()}**")