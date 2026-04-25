# Utility Complaint Agent for Ethiopia - Product Plan

## 1. Improved Product Plan
The **Utility Complaint Agent for Ethiopia** is an AI-powered assistant designed to streamline the reporting of local utility issues (electricity, water, internet) to relevant authorities. The updated version shifts from a simple text-generator to an **action-oriented, community-driven platform**. It introduces crowd-sourced verifying ("Me Too"), spatial tracking with maps, local language support, and actionable next steps like sharing on X (Twitter), generating formal letters, and emergency keyword detection. The ultimate vision includes Telegram bot integration for maximum accessibility in Ethiopia.

## 2. Updated Feature List
- **Localization:** UI toggle for English/Amharic. Complaint generation supports English, Amharic, Afaan Oromo, and Tigrinya.
- **Action Hub:** Provides utility contact information based on the issue type, a "Post to X/Twitter" button with pre-filled content, and a button to export a formal PDF/Text complaint.
- **Social Proof & "Me Too":** A live sidebar showing recent reports. Users can click "+1 Me Too" on existing issues to boost priority instead of creating duplicates.
- **Map Dashboard:** Visualizes reports across Addis Ababa sub-cities/neighborhoods using approximate coordinates, highlighting hotspots.
- **Safety/Emergency Triggers:** Detects words like `spark`, `fire`, `flood`, sets urgency to "Emergency", and displays immediate safety warnings rather than just formal letters.
- **Telegram Bridge:** Generates a unique tracking code (e.g., `UCA-ADDIS-BOLE-20260425-001`) laying the groundwork for a future Telegram bot backend integration.

## 3. Updated Database Schema (SQLite)
Table: `complaints`
- `id` (INTEGER PRIMARY KEY)
- `description` (TEXT)
- `area` (TEXT)
- `utility_type` (TEXT)
- `time_started` (TEXT)
- `category` (TEXT)
- `urgency` (TEXT)
- `generated_message` (TEXT)
- `follow_up_message` (TEXT)
- `status` (TEXT) - New, Reported, Followed Up, Resolved
- `report_count` (INTEGER) - Defaults to 1. Incremented on "Me Too".
- `is_verified` (BOOLEAN) - True if `report_count > 3` within 2 hours.
- `latitude` (REAL)
- `longitude` (REAL)
- `language` (TEXT)
- `telegram_code` (TEXT)
- `timestamp` (DATETIME)

## 4. Agent Workflow
1. User enters issue, area (optional), and selects preferred language (English, Amharic, Afaan Oromo, Tigrinya).
2. The agent pre-processes the text to check for **Emergency Keywords** (e.g., fire, spark). If found, immediately flags as Emergency and alerts the user.
3. If not an emergency, AI classifies the issue and generates a formal, polite complaint in the selected language.
4. AI assigns approximate coordinates based on the entered area if it matches a known location in Addis Ababa.
5. The issue is saved to the SQLite database. A unique Telegram tracking code is generated.
6. The user is redirected to the **Action Hub** to:
   - View relevant contacts (e.g., Ethiopian Electric Utility, AAWSA).
   - "Post to X" or download a formal letter.
7. Future users experiencing the same issue can click "Me Too", incrementing the `report_count` and potentially verifying the issue.

## 5. UI Layout
- **Sidebar:** 
  - Language Toggle (English / Amharic)
  - "Live Outages" feed (showing recent complaints and a "+1 Me Too" button).
- **Tab 1: Submit Complaint:** Main input form, language selector. Post-analysis, shows the **Action Hub** and AI outputs.
- **Tab 2: Map & Dashboard:** Scatter map of outages using `st.map`, plus bar charts for Area and Utility Type.
- **Tab 3: Complaint Tracker:** A robust table showing all reports, their verification status (Verified Badge), and Telegram tracking codes.

## 7. Setup Instructions
To run this Streamlit application locally:
1. Ensure Python 3.9+ is installed.
2. Install dependencies:
   ```bash
   pip install streamlit pandas google-genai
   ```
3. Set your Gemini API key in your terminal:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```
   *(Windows: `set GEMINI_API_KEY=your-api-key-here`)*
4. Run the app:
   ```bash
   streamlit run app.py
   ```

## 8. Sample Test Complaints
- **Electricity (Routine):** "Power has been out in Megenagna since morning."
- **Water (Routine):** "We haven't had running water in Bole area for 3 days."
- **Internet:** "Ethio telecom internet is completely down around Kazanchis."
- **Emergency (Safety Trigger):** "A transformer exploded and caught fire near Piassa roundabout."
- **Amharic input:** "መብራት ከጠዋት ጀምሮ የለም" (No electricity since morning).

## 9. Hackathon Pitch
**Pitch:** 
"In Ethiopia, dealing with power outages, water shortages, and internet drops is a daily reality. But reporting these issues is often chaotic—people vent on social media or make fragmented phone calls, making it hard for authorities to track problems. 

Meet the **Utility Complaint Agent for Ethiopia**. It takes messy, informal complaints and uses AI to turn them into structured, actionable reports in English, Amharic, Afaan Oromo, or Tigrinya. But it goes beyond just writing letters. It features a 'Me Too' crowdsourcing system to verify area-wide outages, detects emergency hazards like transformer explosions to warn users instantly, and maps hotspots for community leaders. Finally, it acts as an Action Hub—providing direct utility contacts and pre-filled tweets to get the right eyes on the problem. It's not just a complaint tool; it's a civic action platform for a more connected Ethiopia."
