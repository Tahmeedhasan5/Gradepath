# GradePath

A free, browser-based grade planner. Add courses and individual assessments, enter each assessment's percentage of the final course grade, and see what average you need on the work that remains to hit your target.

## Run it locally

1. Download or clone this folder.
2. In a terminal opened inside the folder, run `python -m http.server 8000`.
3. Visit `http://localhost:8000` in a modern browser.
4. On first visit, complete the profile form (name and grade/year; school name is optional) and accept the Terms of Use & Privacy Notice. Then add your own courses and assessments.

No build step, package manager, API key, or backend is required.

## Publish with GitHub Pages

1. Create a new repository on GitHub (for example, `gradepath`).
2. Upload **all files in this folder** to the repository root. Make sure `index.html`, `styles.css`, `app.js`, and `favicon.svg` are at the top level, not inside another nested folder.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder, then save.
6. Wait for GitHub Pages to publish the site. The Pages settings screen will show its URL.

## How the grade math works

- Each assessment's weight is a percentage of the **final course grade**.
- All assessment weights plus any not-yet-assigned course weight should total 100%.
- Leave the grade field blank for work that has not been graded yet.
- Current grade is the weighted average of graded assessments only.
- Required average is calculated across all remaining course weight, including weight that has not yet been assigned to a specific assessment.
- The “Plan your next score” tool calculates the grade needed on the selected upcoming assessment, assuming the average you choose on all other remaining course work.

The app prevents planned assessment weights from adding up to more than 100%. It allows less than 100% so you can add assessments later.

## Privacy and storage

Each visitor gets a separate workspace because profile details and course data are stored in that visitor's browser `localStorage`. The first-visit Terms of Use & Privacy Notice explains what is stored and requires acceptance before continuing. Changes are saved when a course or assessment is added, edited, or deleted. This static version does not upload profile details or grades to a GradePath account or database, and it does not sell or publish that information to the general public. The website host may process ordinary technical request information when the site loads; this is separate from the profile and grade data entered into the tool.

This is browser-specific storage, not an online user account: the same person will not automatically see their data on another device or in another browser. Clearing browser data may erase saved courses, so use **Export** in the top-right corner to download a JSON backup and use **Import** to restore it on another device. If multiple people use the same browser profile, they will share that browser's GradePath data. True account-based syncing between devices requires adding an authentication and database service.

## Profile and terms

Visitors can add a name, grade/year and optional school name through the first-visit profile and Terms of Use popup. They can edit this profile later using the profile control in the top bar. The terms notice explains local browser storage, shared-device risks, backup/export, no cloud syncing, and the no-sale statement.

The course header has a visible **Delete course** action with a confirmation prompt.

## Files

- `index.html` — page structure and dialogs
- `styles.css` — responsive design and print styles
- `app.js` — grade calculations, course management, persistence, import/export
- `favicon.svg` — browser tab icon

## Notes

GradePath is an independent planning aid. Confirm your school's grading rules, weighting method, rounding policy, and any dropped-assignment or extra-credit rules. This version assumes every assessment weight is a direct percentage of the final course grade; it does not yet model category-based weighting, dropped grades, curves, or extra credit.
