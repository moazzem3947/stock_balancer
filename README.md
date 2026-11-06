# STOCK ALTER PRO — Neo-Brutalism Short & Excess Balancing System (Node.js + JSON DB)

## Features Included
1. **Home Dashboard & Smart Auto-Matcher**:
   - Displays **Total Short Taka** and **Total Excess Taka** cleanly at the top.
   - Search by Product Name or Code (plus 1-click Short product selector chips).
   - **Priority 1**: Shows **Same Name / Brand** Excess products first (`একই নামের অন্য প্রোডাক্ট আগে দেখানো হয়`).
   - **Priority 2**: Shows **Same or Close Price** Excess products (`একই দামের প্রোডাক্ট`).
   - **Priority 3**: Generates **Lower-Priced Multi-Product Combinations** (`কম দামের প্রোডাক্ট মিলিয়ে স্টক সমান করার অপশন`).
2. **Confirmation Message & Stock Balancing**:
   - Displays exact confirmation message:
     > "আপনার স্টকে এই প্রোডাক্ট শর্ট ছিল, আপনি প্রোডাক্টটা বুঝে পেয়েছেন যার বিনিময়ে এই এই প্রোডাক্টগুলো রিটার্ন দেখাতে চাচ্ছেন।"
   - Automatically balances both Short and Excess product quantities and updates totals.
3. **Dedicated Page — `CUSTOM EXCESS PRODUCT SELECTOR (NIJER ICCHA MOTO EXCESS ITEM MILAN)`**:
   - Select any Short product and see all Excess products priced under the target amount.
   - Selecting a product automatically excludes it, calculates the **Remaining Balance (`বাকি টাকা`)**, filters the list to show only products under the remaining amount, and highlights **Smart Suggestions (`কোনটা নিলে ভালো হবে`)**.
4. **All Short & Excess Products Manager**:
   - View, Add, Edit, or Delete any product, and edit unit **Prices** with automatic recalculation.
   - **1-Click Clear All DB** & **Excel File Upload (`.xlsx`/`.xls`/`.csv`)** to update or replace the database.
5. **History & Cancel/Undo**:
   - Tracks every transaction with exact timestamp and product breakdown, with 1-click **Cancel / Undo** to restore stock.
6. **Render Free Hosting & `/health` Cronjob Endpoint**:
   - Uses `data/db.json` (no external DB needed) + automatic browser-to-server backup sync so data survives free-tier restarts.
   - Add `https://your-app-name.onrender.com/health` to [cron-job.org](https://cron-job.org) (every 10–14 minutes) to keep your Render server awake 24/7.

## How to Run Locally or on Render
```bash
npm install
npm start
```
