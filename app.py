import streamlit as st
import sqlite3
import pandas as pd
import json
import os
import datetime
import urllib.parse
import uuid
from google import genai
from google.genai import types

# ---- SETUP & CONFIG ----
api_key = os.environ.get("GEMINI_API_KEY", "")
client = genai.Client(api_key=api_key) if api_key else None

DB_NAME = 'complaints_v2.db'

# Geographic approximations for Addis Ababa areas to enable st.map
# Format: {"Area Name": (latitude, longitude)}
AREA_COORDS = {
    "bole": (8.9900, 38.7800),
    "yeka": (9.0200, 38.8000),
    "megenagna": (9.0200, 38.8000),
    "arada": (9.0300, 38.7500),
    "piassa": (9.0300, 38.7500),
    "kirkos": (9.0100, 38.7600),
    "kazanchis": (9.0150, 38.7650),
    "lideta": (9.0100, 38.7300),
    "gulele": (9.0500, 38.7300),
    "nifas silk-lafto": (8.9800, 38.7300),
    "kolfe keranio": (9.0200, 38.7000),
    "akaki kality": (8.8800, 38.7800),
    "addis ketema": (9.0300, 38.7200),
    "cmc": (9.0200, 38.8400),
    "sarbet": (8.9900, 38.7400)
}

EMERGENCY_KEYWORDS = [
    "spark", "fire", "exploded", "explosion", "flooding", "flood",
    "exposed wire", "electric shock", "burning smell", "transformer blast",
    "sewage overflow", "contaminated water", "hazard", "danger"
]

# UI Localization Dictionary
LOCALES = {
    "English": {
        "title": "⚡ Utility Complaint Agent (Ethiopia)",
        "subtitle": "An AI assistant to help you report, organize, and follow up on everyday utility problems.",
        "submit_tab": "📝 Submit Complaint",
        "tracker_tab": "📋 Complaint Tracker",
        "map_tab": "🗺️ Map & Dashboard",
        "form_description": "What is the problem? *",
        "form_area": "Area / Neighborhood (e.g. Piassa, Addis Ababa)",
        "form_time": "When did it start? (e.g. 2 hours ago)",
        "form_utility": "Select Utility Type",
        "form_lang": "Generate complaint message in:",
        "analyze_btn": "Analyze & Generate Complaint",
        "live_outages": "🔴 Live Outages",
        "me_too_btn": "Me Too (+1)",
        "verified": "✅ Verified",
        "action_hub": "⚡ Action Hub"
    },
    "Amharic": {
        "title": "⚡ የአገልግሎት ቅሬታ አቅራቢ (ኢትዮጵያ)",
        "subtitle": "የዕለት ተዕለት የመብራት፣ የውሃ እና የኢንተርኔት ችግሮችን ሪፖርት ለማድረግ እና ለመከታተል የሚረዳ የ AI ረዳት::",
        "submit_tab": "📝 ቅሬታ ያስገቡ",
        "tracker_tab": "📋 የቅሬታ መከታተያ",
        "map_tab": "🗺️ ካርታ እና ዳሽቦርድ",
        "form_description": "ችግሩ ምንድን ነው? *",
        "form_area": "አካባቢ / ሰፈር (ለምሳሌ ፒያሳ፣ አዲስ አበባ)",
        "form_time": "መቼ ጀመረ? (ለምሳሌ ከ2 ሰዓት በፊት)",
        "form_utility": "የአገልግሎት ዓይነት ይምረጡ",
        "form_lang": "የቅሬታ መልዕክት የሚጻፍበት ቋንቋ:",
        "analyze_btn": "ቅሬታውን አዘጋጅ",
        "live_outages": "🔴 ወቅታዊ ችግሮች",
        "me_too_btn": "እኔም አጋጥሞኛል (+1)",
        "verified": "✅ የተረጋገጠ",
        "action_hub": "⚡ ቀጣይ እርምጃዎች"
    }
}

# ---- DATABASE FUNCTIONS ----
def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)

def init_db():
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_code TEXT,
            description TEXT,
            area TEXT,
            utility_type TEXT,
            time_started TEXT,
            category TEXT,
            urgency TEXT,
            generated_message TEXT,
            follow_up_message TEXT,
            status TEXT DEFAULT 'New',
            report_count INTEGER DEFAULT 1,
            is_verified BOOLEAN DEFAULT 0,
            latitude REAL,
            longitude REAL,
            language TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()

def generate_telegram_code(area):
    date_str = datetime.datetime.now().strftime("%Y%m%d")
    short_uuid = str(uuid.uuid4())[:4].upper()
    safe_area = "".join([c for c in str(area) if c.isalpha()])[:6].upper()
    if not safe_area: safe_area = "UNKNOWN"
    return f"UCA-{safe_area}-{date_str}-{short_uuid}"

def get_coords(area_text):
    if not area_text: return None, None
    area_lower = area_text.lower()
    for key, coords in AREA_COORDS.items():
        if key in area_lower:
            return coords[0], coords[1]
    return None, None

def increment_me_too(complaint_id):
    conn = get_connection()
    c = conn.cursor()
    # Increment count
    c.execute("UPDATE complaints SET report_count = report_count + 1 WHERE id = ?", (complaint_id,))
    # Check verification (if > 3 reports, mark verified)
    c.execute("UPDATE complaints SET is_verified = 1 WHERE id = ? AND report_count > 3", (complaint_id,))
    conn.commit()

init_db()

# ---- STREAMLIT UI ----
st.set_page_config(page_title="Utility Complaint Agent - Ethiopia", layout="wide")

if 'logged_in' not in st.session_state:
    st.session_state['logged_in'] = False
    st.session_state['role'] = None

# Sidebar Content
# Only show language/live outages to user or logged out. But we'll just put language everywhere.
ui_lang = st.sidebar.radio("Language / ቋንቋ", ["English", "Amharic"])
t = LOCALES[ui_lang]

st.title(t["title"])
st.write(t["subtitle"])

if not api_key:
    st.sidebar.warning("⚠️ GEMINI_API_KEY not set. Using fallback mock generation.")

if not st.session_state['logged_in']:
    st.subheader("Login")
    st.info("Demo Accounts:\n- User: **user** / **user123**\n- Admin: **admin** / **admin123**")
    username = st.text_input("Username")
    password = st.text_input("Password", type="password")
    if st.button("Login"):
        if username == "admin" and password == "admin123":
            st.session_state['logged_in'] = True
            st.session_state['role'] = 'admin'
            st.rerun()
        elif username == "user" and password == "user123":
            st.session_state['logged_in'] = True
            st.session_state['role'] = 'user'
            st.rerun()
        else:
            st.error("Invalid credentials. Try user/user123 or admin/admin123")
else:
    st.sidebar.divider()
    if st.sidebar.button("Logout"):
        st.session_state['logged_in'] = False
        st.session_state['role'] = None
        st.rerun()

    if st.session_state['role'] == 'user':
        # --- USER VIEW ---
        st.sidebar.divider()
        st.sidebar.subheader(t["live_outages"])
        
        # Fetch recent complaints for sidebar
        conn = get_connection()
        recent_df = pd.read_sql_query("SELECT id, utility_type, area, report_count, is_verified, time_started FROM complaints ORDER BY timestamp DESC LIMIT 5", conn)
        
        if not recent_df.empty:
            for _, row in recent_df.iterrows():
                verified_badge = t["verified"] if row['is_verified'] else ""
                st.sidebar.markdown(f"**{row['utility_type']} in {row['area']}** {verified_badge}")
                st.sidebar.caption(f"{row['time_started']} | Reports: {row['report_count']}")
                if st.sidebar.button(f"{t['me_too_btn']} ##{row['id']}", key=f"me_too_{row['id']}"):
                    increment_me_too(row['id'])
                    st.sidebar.success("Recorded! Priority boosted.")
                    st.rerun()
        else:
            st.sidebar.caption("No recent reports.")

        st.header(t["submit_tab"])
        
        with st.form("complaint_form"):
            description = st.text_area(t["form_description"], height=100)
            
            col1, col2 = st.columns(2)
            with col1:
                area = st.text_input(t["form_area"])
                time_started = st.text_input(t["form_time"])
            with col2:
                utility_type = st.selectbox(t["form_utility"], ["Let AI Decide", "Electricity", "Water", "Internet/Telecom", "Billing Issue", "Other"])
                output_lang = st.selectbox(t["form_lang"], ["English", "Amharic", "Afaan Oromo", "Tigrinya"])
            
            submitted = st.form_submit_button(t["analyze_btn"], type="primary")
            
        if submitted and description:
            # 1. Emergency Check
            is_emergency = any(kw in description.lower() for kw in EMERGENCY_KEYWORDS)
            
            if is_emergency:
                st.error("🚨 **EMERGENCY RISK DETECTED!** 🚨\nPlease move away from the affected area immediately. Do not touch exposed wires, flooded utility areas, or burning infrastructure. Contact emergency services or the utility provider's emergency line instantly. **905 for Electricity, 939 for Police/Fire.**")

            # 2. AI Analysis
            with st.spinner("Analyzing..."):
                urgency_override = "Emergency" if is_emergency else None
                
                prompt = f"""
                You are a helpful civic assistant in Ethiopia helping a user format a utility complaint.
                Analyze the following details. If information is missing, note it.
                Generate a clear, formal complaint message AND a follow-up message in {output_lang}.

                Area: {area if area else "Not provided"}
                Utility Type: {utility_type}
                Time Started: {time_started if time_started else "Not provided"}
                User Description: {description}
                Emergency Override: {urgency_override if urgency_override else "Determine normally"}

                Return raw JSON matching this schema:
                {{
                    "category": "Issue category (e.g. Electricity outage, Water shortage)",
                    "urgency": "Low, Medium, High, or Emergency",
                    "missingDetails": ["detail 1"],
                    "generatedMessage": "Formal polite complaint message in {output_lang}",
                    "followUpMessage": "Polite follow-up message in {output_lang}"
                }}
                """
                
                result = None
                if client:
                    try:
                        response = client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                temperature=0.2
                            )
                        )
                        result = json.loads(response.text)
                    except Exception as e:
                        st.error(f"Analysis failed: {e}")
                else:
                    # Mock AI for local testing
                    result = {
                        "category": utility_type if utility_type != "Let AI Decide" else "Electricity",
                        "urgency": urgency_override or "Medium",
                        "missingDetails": ["Specific house number/landmark"],
                        "generatedMessage": f"(MOCK) I am writing to report a {utility_type} issue in {area}.",
                        "followUpMessage": f"(MOCK) Following up on the {utility_type} issue in {area}."
                    }
                
                if result:
                    st.session_state.temp_result = result
                    st.session_state.temp_inputs = {
                        "description": description,
                        "area": area,
                        "utility_type": result.get("category", utility_type),
                        "time_started": time_started,
                        "output_lang": output_lang
                    }

        # 3. Action Hub & Results
        if "temp_result" in st.session_state:
            res = st.session_state.temp_result
            inp = st.session_state.temp_inputs
            
            st.success("✅ Analysis Complete!")
            st.markdown("---")
            st.subheader(t["action_hub"])
            
            # Save to DB
            if "telegram_code" not in st.session_state:
                lat, lon = get_coords(inp["area"])
                t_code = generate_telegram_code(inp["area"])
                
                c = get_connection().cursor()
                c.execute('''
                    INSERT INTO complaints (telegram_code, description, area, utility_type, time_started, category, urgency, generated_message, follow_up_message, latitude, longitude, language)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (t_code, inp["description"], inp["area"], inp["utility_type"], inp["time_started"], res.get("category"), res.get("urgency"), res.get("generatedMessage"), res.get("followUpMessage"), lat, lon, inp["output_lang"]))
                get_connection().commit()
                st.session_state.telegram_code = t_code
                
            t_code = st.session_state.telegram_code
            
            action_col1, action_col2 = st.columns(2)
            
            with action_col1:
                st.info(f"**Telegram Tracking Code:** `{t_code}`\n\n*(Future Feature: Send this code to our Telegram bot to receive live status updates!)*")
                
                cat_lower = res.get("category", "").lower()
                if "electric" in cat_lower or "power" in cat_lower:
                    st.markdown("**📞 Contact:** Ethiopian Electric Utility (EEU)\n- **Hotline:** 905\n- **X (Twitter):** [@EEUEthiopia](#)")
                    twitter_handle = "@EEUEthiopia"
                elif "water" in cat_lower:
                    st.markdown("**📞 Contact:** Addis Ababa Water and Sewerage Authority (AAWSA)\n- **Hotline:** 805 or 905 (varies by sub-city)\n- **X (Twitter):** [@AAWSA_Official](#)")
                    twitter_handle = "@AAWSA_Official"
                elif "internet" in cat_lower or "telecom" in cat_lower:
                    st.markdown("**📞 Contact:** Ethio Telecom\n- **Hotline:** 994\n- **X (Twitter):** [@ethiotelecom](#)")
                    twitter_handle = "@ethiotelecom"
                else:
                    st.markdown("**📞 Contact:** Local Woreda/Kebele office")
                    twitter_handle = "@MayorOfAddis"
                    
            with action_col2:
                st.markdown("**Generate Tweet / X Post**")
                tweet_text = f"Experiencing a {res.get('category')} in {inp['area']}. It's been ongoing since {inp['time_started']}. Priority: {res.get('urgency')}. Please assist. {twitter_handle} #Ethiopia #AddisAbaba"
                tweet_text = tweet_text[:275]
                tweet_url = f"https://twitter.com/intent/tweet?text={urllib.parse.quote(tweet_text)}"
                st.markdown(f'<a href="{tweet_url}" target="_blank" style="display: inline-block; padding: 0.5em 1em; background-color: #1DA1F2; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">🐦 Post to X / Twitter</a>', unsafe_allow_html=True)
                
                st.markdown("<br>", unsafe_allow_html=True)
                
                letter_content = f"""Date: {datetime.datetime.now().strftime("%Y-%m-%d")}
Subject: Official Complaint Regarding {res.get('category')}

To the relevant authority,

Location: {inp['area']}
Issue Started: {inp['time_started']}
Severity: {res.get('urgency')}

{res.get('generatedMessage')}

Sincerely,
[Your Name]
[Your Phone Number]
Tracking Code: {t_code}
"""
                st.download_button(
                    label="📄 Download Formal Letter (TXT)",
                    data=letter_content,
                    file_name=f"Utility_Complaint_{t_code}.txt",
                    mime="text/plain"
                )

            st.markdown("---")
            st.subheader("📝 Generated Output")
            st.code(res.get("generatedMessage", ""), language="text")
            st.caption("Suggested Follow-up Message:")
            st.code(res.get("followUpMessage", ""), language="text")
            
            if st.button("Start New Complaint"):
                del st.session_state.temp_result
                del st.session_state.temp_inputs
                del st.session_state.telegram_code
                st.rerun()

    elif st.session_state['role'] == 'admin':
        # --- ADMIN VIEW ---
        admin_tabs = st.tabs([t["map_tab"], t["tracker_tab"]])
        
        with admin_tabs[0]:
            st.header(t["map_tab"])
            
            conn = get_connection()
            df = pd.read_sql_query("SELECT * FROM complaints", conn)
            
            if not df.empty:
                map_df = df.dropna(subset=['latitude', 'longitude'])
                
                if not map_df.empty:
                    st.subheader("Geographic Hotspots (Addis Ababa)")
                    map_df['color'] = map_df['urgency'].apply(lambda x: '#FF0000' if x == 'Emergency' or x == 'High' else '#FFaa00' if x == 'Medium' else '#00FF00')
                    map_df['size'] = map_df['report_count'] * 100
                    
                    st.map(map_df, latitude="latitude", longitude="longitude", size="size", color="color")
                else:
                    st.info("No recognizable locations with coordinates mapping available yet.")
                    
                st.markdown("---")
                col1, col2 = st.columns(2)
                with col1:
                     st.subheader("By Area")
                     st.bar_chart(df['area'].value_counts())
                with col2:
                     st.subheader("By Utility Category")
                     st.bar_chart(df['utility_type'].value_counts())
            else:
                st.info("No data available to map.")
        
        with admin_tabs[1]:
            st.header(t["tracker_tab"])
            conn = get_connection()
            df = pd.read_sql_query("SELECT id, telegram_code, timestamp, area, utility_type, category, urgency, report_count, is_verified, status FROM complaints ORDER BY timestamp DESC", conn)
            
            if not df.empty:
                df['is_verified'] = df['is_verified'].apply(lambda x: "✅ Verified" if x else "Pending")
                # Show dataframe
                st.dataframe(df, use_container_width=True, hide_index=True)
                
                st.markdown("### Update Complaint Status")
                complaint_ids = df['id'].astype(str).tolist()
                selected_id = st.selectbox("Select Complaint ID", complaint_ids)
                new_status = st.selectbox("New Status", ["New", "Reported", "Followed Up", "Resolved"])
                if st.button("Update Status"):
                    c = conn.cursor()
                    c.execute("UPDATE complaints SET status = ? WHERE id = ?", (new_status, selected_id))
                    conn.commit()
                    st.success(f"Updated status for ID {selected_id} to '{new_status}'")
                    st.rerun()
            else:
                st.info("No complaints tracked yet.")
