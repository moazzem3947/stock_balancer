# Stock Short & Excess Return Balancing System (v2.0 Pro)

## What's Fixed & Upgraded in v2.0
1. **Confirm Button 100% Fixed:** Eliminated inline single-quote syntax errors on product names like `10X10'S` and replaced blocked browser dialogs with an interactive Bangla Confirmation Modal (`#banglaConfirmModal`) and Toast notifications.
2. **Dedicated Page for Custom Excess Product Selector (`NIJER ICCHA MOTO EXCESS ITEM MILAN`):**
   - Full dedicated page (`✨ নিজের ইচ্ছামতো মিলান`) accessible from top/bottom navigation.
   - Live search by Product Name or Code.
   - Automatically filters and displays products whose price is **under the Remaining Amount (`বাকি টাকা`)**.
   - Selecting any product automatically **excludes** it from the available list, deducts its value from the target, and updates the **Smart Suggestions (`কোনটা নিলে ভালো হবে`)** and **Under-Remaining Product List** for the remaining Taka!
3. **Mobile-Friendly Sticky Header & Advanced 3-Dot (`⋮`) Menu:**
   - Compact sticky header that never wraps or pushes down on mobile phones.
   - Top-right **3-Dot (`⋮`)** menu for quick navigation, Price Basis switching (`TP + VAT` vs `TP`), CSV export, and `/health` Cronjob setup.
   - Fixed Bottom Navigation Bar on mobile screens.
4. **Modern Semantic Color Palette:**
   - **Rose-Crimson** for Short Stock (`ঘাটতি`)
   - **Emerald-Teal** for Excess Stock & Selected Basket (`অতিরিক্ত / নেয়া হয়েছে`)
   - **Royal Indigo & Amber** for Target & Remaining Balance (`বাকি টাকা`)
   - **Vivid Violet** for Smart Suggestions (`কোনটা নিলে ভালো হবে`)
5. **Removed Restore Options:** All database/seed restore buttons have been removed from the Excel Upload & DB page.
6. **Render Data Persistence & `/health` Cronjob API:**
   - Added `GET /health`, `HEAD /health`, `GET /api/health`, and `GET /ping` for **cron-job.org**.
   - Added 3-Layer Auto-Persistence (`database.json` + Browser-to-Server Auto-Heal `/api/sync-state` + optional Google Sheets cloud sync) so previous work is never lost even if Render restarts.
