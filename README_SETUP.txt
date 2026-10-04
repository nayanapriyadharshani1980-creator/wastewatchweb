WASTE WATCH REPORTING UPGRADE

Files:
- index.html, style.css, script.js: upgraded map UI with complaint dashboard, public complaint markers, and status tracking.
- Code.gs: replacement Google Apps Script for public map reports, counts, and reference-code status lookup.
- data/: GeoJSON files are included only if they were present in the working folder. If missing, copy your original data folder into this project folder.

IMPORTANT SETUP STEPS
1. Open your existing Apps Script project.
2. Replace the current script code with Code.gs and save.
3. Run setupReportsSheet once. It preserves the existing first 10 columns and adds Report ID in column K.
4. Deploy > Manage deployments > Edit your web app deployment. Choose New version and deploy. Keep the same /exec endpoint if updating the existing deployment.
5. Confirm the web app is accessible to the intended audience. For a public complaint form, access may need to be set to Anyone.
6. Test a NEW report submission. A reference number beginning WW- should appear in the success message and be saved in column K.
7. Change column J (Status) to exactly Pending, Verified, Registered, or Rejected. The public dashboard and map markers refresh approximately every minute.

STATUS TRACKING
- New submissions are Pending.
- Reporters can save their WW- reference number and enter it in Track your report.
- Tracking returns only status, district, waste type and timestamp.
- The public map endpoint returns only coordinates, district, waste type, severity, status and timestamp. It does not publish descriptions, photo URLs or report reference IDs.
- Existing rows created before this upgrade will have no Report ID; they cannot be tracked by reference number unless you assign unique IDs to them.

NOTE
The form uses no-cors for its POST. The browser cannot read the Apps Script response, so the success message means the request was sent, not independently confirmed. Check the Reports sheet for each new row. The read-only endpoints use JSONP to work around common cross-origin fetch restrictions with Apps Script ContentService.
