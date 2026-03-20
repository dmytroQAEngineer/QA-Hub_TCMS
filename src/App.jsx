import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { storageAPI } from "./storage";
import "./App.css";

// ── DATA ─────────────────────────────────────────────────────────────────────
const RAW_CASES = [
  [1001,"TC-001 Create a basic ticket type","Ticket Management","Critical","Bob",true,
   "Logged in as Org Admin. Active event exists on tickets.fastbreak-dev.ai.",
   "Ticket appears with Name, Price, Quantity. QR auto-generated. Wristband color saved.",
   [["Open browser and go to tickets.fastbreak-dev.ai. Log in as Org Admin.","Dashboard appears. Organization name visible in top nav."],
    ["In left sidebar click Events. Click on any active event.","Event detail page opens with tabs: Overview, Tickets, Attendees, Settings."],
    ["Click the Tickets tab.","Tickets tab opens. An Add Ticket button is visible in the top right."],
    ["Click the Add Ticket button.","The Ticket Wizard opens with a multi-step form."],
    ["Fill in Name: General Admission, Price: 25.00, Quantity: 100.","All fields show input with no validation errors."],
    ["Click Next to advance to Wristband Color step. Click the White color swatch.","White swatch becomes highlighted indicating it is selected."],
    ["Click Review to preview settings. Verify all details. Click Save Ticket.","Success message appears. You are returned to the Tickets tab."],
    ["Look at the Tickets tab list for the new General Admission ticket.","Ticket appears with correct Name, Price, Quantity. QR code visible. White wristband color shown."]]],
  [1002,"TC-002 Ticket inventory enforces hard limit no oversell","Ticket Management","Critical","Bob",true,
   "Ticket type exists with Quantity 2. Public checkout URL available. Test card: 4242 4242 4242 4242, expiry 12/34, CVC 123.",
   "The 3rd purchase attempt is blocked. Ticket shows Sold Out. No 3rd transaction in Stripe or Attendees.",
   [["Copy the public checkout URL for the ticket type (Quantity 2 is already set per preconditions).","Checkout URL is ready to use."],
    ["Open the checkout URL in Browser 1. Add 1 ticket and complete payment with the test card.","Purchase 1 succeeds."],
    ["Open the same URL in a second browser or incognito tab. Complete another purchase.","Purchase 2 succeeds. Both tickets are now sold."],
    ["Open the same URL in a third browser tab. Try to add the ticket to the cart.","Ticket shows as Sold Out. Add to cart button is disabled. No 3rd transaction in Attendees or Stripe."]]],
  [1003,"TC-003 Ticket QR code generates correctly and is scannable","Ticket Management","Critical","Bob",true,
   "A ticket purchase has been completed. Order confirmation email received. Snap Entry installed on a test device.",
   "QR code renders correctly. Snap Entry shows green success screen with correct holder name and ticket type.",
   [["Complete a ticket purchase. Wait for the order confirmation email.","Confirmation email arrives with a View Ticket link."],
    ["Open the email and click View Ticket.","The digital ticket page opens in your browser."],
    ["Verify: QR image loads, holder name is correct, ticket type shows the actual name (e.g. General Admission) and does NOT say unknown, wristband color is visible.","All items display correctly. Ticket type name is shown correctly, not the word unknown."],
    ["Open Snap Entry, log in, select the event, tap Entry Scan, and scan the QR code.","Green success screen appears. Holder name and ticket type are correct."]]],
  [1004,"TC-004 Ticket metadata collected before Stripe session","Ticket Management","Critical","Bob",true,
   "Event has Ticket Metadata configured: Ticket Holder Name (Required), Team Name (Optional), Jersey Number (Numeric, Required).",
   "Metadata form appears before Stripe. Required fields enforced. Spaces rejected. Metadata visible on Attendee Detail and QR ticket.",
   [["Go to Event Settings then Ticket Metadata. Add the 3 configured fields and save.","All 3 fields saved and listed."],
    ["Open the public checkout URL. Select 1 ticket and proceed.","A metadata form appears before the Stripe payment screen."],
    ["Leave required fields empty. Try to proceed.","Form blocks you. Error messages appear on empty required fields."],
    ["Type only spaces in a required field. Try to proceed.","Form still blocks you. Spaces are not accepted as valid input."],
    ["Leave optional Team Name blank. Fill in other required fields. Continue.","Form accepts and proceeds to the Stripe payment screen."],
    ["Complete the payment. Open the Attendee Detail page in the admin dashboard.","The metadata you entered is visible on the Attendee Detail page."],
    ["Open the digital QR ticket from the confirmation email.","The metadata fields are also visible on the digital ticket."]]],
  [1005,"TC-005 Max 3 metadata fields enforced","Ticket Management","Critical","Bob",true,
   "Logged in as Org Admin. Navigate to Event Settings then Ticket Metadata.",
   "Adding a 4th metadata field is prevented. A message explains the 3-field maximum.",
   [["Add 3 metadata fields and save.","All 3 fields saved successfully."],
    ["Try to add a 4th field by clicking Add Field.","Button is disabled or hidden. A message explains the 3-field maximum. No 4th field is created."]]],
  [1006,"TC-006 Wristband color is required during ticket creation","Ticket Management","Critical","Bob",true,
   "Logged in as Org Admin. Ticket Wizard open for a new ticket.",
   "Wizard blocks advancement without a color selected. Clear validation message shown.",
   [["Fill in Name, Price, and Quantity in the Ticket Wizard.","First step filled out with no errors."],
    ["On the Wristband Color step do NOT select any color. Try to click Next or Review.","Wizard does not advance. Validation message appears requiring a color selection."]]],
  [1007,"TC-007 Wristband color updates reflect on existing purchased tickets","Ticket Management","High","Alice",false,
   "A ticket has been purchased with Wristband Color set to White.",
   "After changing to Blue the digital ticket immediately shows Blue. All other data unchanged.",
   [["Open the digital ticket from the confirmation email and confirm it currently shows White wristband color.","Digital ticket displays White wristband."],
    ["As Org Admin go to Tickets tab, find the ticket type, click Edit. Change color to Blue. Save.","Ticket type saved with Blue wristband color."],
    ["Reload the digital ticket page in your browser (press F5 or use the browser refresh button).","Ticket now shows Blue wristband. All other details unchanged."]]],
  [1008,"TC-008 Revoke ticket QR becomes invalid immediately","Ticket Management","Critical","Bob",true,
   "A ticket purchase has been completed. Admin dashboard and Snap Entry on a mobile device are available.",
   "After revoking, status shows Revoked. Snap Entry shows red rejection. No check-in recorded.",
   [["In admin dashboard go to Attendees. Find the order and open Attendee Detail.","Attendee Detail page shows the ticket as active."],
    ["Click Revoke Ticket and confirm in the dialog.","Ticket status immediately updates to Revoked."],
    ["On mobile open Snap Entry, navigate to the event, scan the revoked ticket QR code.","Red rejection screen appears. No check-in recorded. App returns to scan-ready state."]]],
  [1009,"TC-009 Revoking Season Pass prompts to revoke child tickets","Ticket Management","Critical","Bob",true,
   "A customer has purchased a Season Pass which generated individual event tickets.",
   "Modal asks whether to also revoke child tickets. Confirming revokes both. Declining revokes only the Season Pass.",
   [["Go to Season Passholders, find the passholder, open their detail page.","Season Passholder Detail page opens."],
    ["Click Revoke or Refund and Revoke.","A modal appears asking if you also want to revoke existing event tickets for this pass."],
    ["Choose to revoke BOTH the Season Pass AND all child tickets.","Season Pass and all child event tickets are revoked."],
    ["Repeat with a different passholder and choose to revoke ONLY the Season Pass.","Only the Season Pass is revoked. Child event tickets remain active."]]],
  [1010,"TC-010 Transfer ticket to a new attendee","Ticket Management","Critical","Bob",true,
   "A ticket has been purchased. Original QR accessible. A different email address is ready for transfer. Snap Entry available.",
   "Original QR rejected by Snap Entry. New QR scans green. Original order page has no 500 error.",
   [["In admin dashboard go to Attendees, find the ticket, open Attendee Detail.","Attendee Detail page opens."],
    ["Click Transfer Ticket. Enter a different email address. Click Confirm.","Transfer completes. New attendee receives a ticket email."],
    ["Open Snap Entry and scan the ORIGINAL QR code.","Snap Entry rejects the scan with Invalid Ticket or Already Transferred message."],
    ["Check the new email inbox and scan the new QR code with Snap Entry.","Green success screen appears. New attendee is checked in."],
    ["Navigate to the original order page in the admin dashboard.","Page loads correctly with no 500 error. Status shows transferred."]]],
  [1011,"TC-011 Promo code percentage discount applied correctly","Checkout and Payments","High","Alice",false,
   "Logged in as Org Admin. A 50 dollar ticket exists. A promo code will be created.",
   "10 dollar discount shown as line item. Fees calculated on 40 dollar subtotal. Stripe charge matches. Usage increments to 1.",
   [["Go to Event, Promotions, Create Promo Code. Set Code SAVE20, Discount 20 percent, Max Uses 5. Save.","Promo code SAVE20 is created."],
    ["Open public checkout, add a 50 dollar ticket, proceed to checkout. Enter SAVE20 and click Apply.","10 dollar discount line item appears. Fees recalculated on 40 dollar subtotal."],
    ["Complete the purchase with the test card.","Payment succeeds. Stripe charge matches discounted total."],
    ["Go to Event, Promotions and find the SAVE20 code. Check the usage count.","Usage count shows 1 of 5. The counter incremented correctly after the purchase."]]],
  [1012,"TC-012 Promo code max-use limit enforced","Checkout and Payments","Critical","Bob",true,
   "A promo code exists with Max Uses 2.",
   "3rd application rejected with clear error. Usage shows 2 of 2. No discount applied on 3rd attempt.",
   [["Complete 2 separate purchases using the promo code.","Both succeed. Usage shows 2 of 2."],
    ["In a new browser session add a ticket and apply the same promo code.","Code is rejected: This promo code has reached its usage limit. No discount applied."]]],
  [1013,"TC-013 Abandoned checkout does not count against promo usage","Checkout and Payments","High","Alice",false,
   "A promo code exists with Max Uses 1.",
   "After abandoning a checkout where the promo was applied the code can still be used. Usage shows 1 of 1 only after a completed purchase.",
   [["Open checkout, apply the promo code, verify discount appears, then close the tab without paying.","Session is abandoned. Promo was NOT consumed."],
    ["Open checkout in a new browser session. Apply the same promo code and complete the purchase.","Promo code is accepted. Purchase succeeds. Usage now shows 1 of 1."]]],
  [1014,"TC-014 Full refund ticket revoked and Stripe refunded","Checkout and Payments","Critical","Bob",true,
   "A ticket purchase has been completed using test card 4242 4242 4242 4242.",
   "Attendee Detail shows order as refunded. Stripe shows full refund. Tax also refunded if enabled. Accounting reflects the refund.",
   [["Go to event Attendees, find the order, open Attendee Detail. Click Refund, Full Refund, Confirm.","Refund is submitted."],
    ["Check the Attendee Detail page status.","Status shows: This order has been refunded."],
    ["Check the Stripe test dashboard.","Full refund is visible in Stripe including any taxes."],
    ["Go to the event Accounting page.","Gross revenue and net totals updated to account for the refund."]]],
  [1015,"TC-015 Partial refund correct amount balance correct","Checkout and Payments","High","Alice",false,
   "A 2-ticket order exists totaling 60 dollars (2 tickets at 30 dollars each).",
   "Stripe shows 30 dollar partial refund. Attendee Detail shows 30 dollar remaining. Net Total NOT displayed. Accounting updated.",
   [["Go to Attendee Detail for the 2-ticket order. Click Refund, Partial Refund. Enter 30.00 and confirm.","Partial refund is processed."],
    ["Check Attendee Detail page.","Shows partial refund status. Refunded 30 dollars. Remaining 30 dollars. Net Total is NOT shown."],
    ["Check Stripe.","Stripe shows a 30 dollar partial refund on the original charge."]]],
  [1016,"TC-016 Standard card checkout end to end","Checkout and Payments","Critical","Bob",true,
   "Public event checkout URL available. Test card: 4242 4242 4242 4242, expiry 12/34, CVC 123.",
   "Confirmation page shown. Email with QR received. Ticket in Attendees. Stripe transaction correct. Processing fee equals actual Stripe fee.",
   [["Open the public checkout URL. Select 1 ticket. Click Checkout.","Checkout page shows the order summary."],
    ["Fill in any required metadata. On the Stripe page enter the test card details. Click Pay.","Payment processes."],
    ["Check the confirmation page and your email inbox.","Confirmation page shown. Email arrives with a View Ticket link and a clear QR code."],
    ["Go to the event Attendees page in the admin dashboard.","Ticket appears in the list with correct buyer info and timestamp."],
    ["Go to the event Accounting page. Find the Processing Fee column for this transaction.","Fee shown equals the actual Stripe fee, not a pre-estimated amount."]]],
  [1017,"TC-017 Sales Tax shown as line item and recorded","Checkout and Payments","Critical","Bob",true,
   "Logged in as Org Admin. A 20 dollar ticket exists. Sales Tax not yet configured.",
   "Tax of 1.70 dollars appears as a separate line item at checkout. Accounting shows Sales Tax to Remit. CSV includes a Sales Tax column.",
   [["Go to Event Dashboard, Configuration, Settings, Sales Tax. Enable it, set rate to 8.5 percent, basis Ticket Subtotal. Save.","Sales Tax is enabled."],
    ["Open the public checkout URL. Add a 20 dollar ticket and proceed.","Order summary shows Subtotal 20 dollars and Tax 1.70 dollars as a separate line item."],
    ["Complete the purchase. Go to the event Accounting page.","Accounting page shows a Sales Tax to Remit column with 1.70 dollars for this transaction."],
    ["Export the Accounting CSV and open it.","CSV contains a Sales Tax column with 1.70 dollars for this transaction."]]],
  [1018,"TC-018 Sales Tax also refunded on full refund","Checkout and Payments","Critical","Bob",true,
   "Sales Tax enabled at 8.5 percent. A 20 dollar ticket was purchased (tax 1.70 dollars).",
   "Stripe refund includes the 1.70 dollar tax. Accounting Sales Tax to Remit decreases by 1.70 dollars.",
   [["Go to Attendee Detail for the tax-enabled purchase. Click Refund, Full Refund, Confirm.","Refund is initiated."],
    ["Check the Stripe test dashboard.","Refund includes the full amount including 1.70 dollar tax."],
    ["Go to the Accounting page and expand the Sales Tax to Remit section.","Breakdown shows 1.70 dollars collected and 1.70 dollars refunded, resulting in 0.00 dollars net tax to remit."]]],
  [1019,"TC-019 All-In Pricing event-level override wins over org default","Checkout and Payments","Critical","Bob",true,
   "Logged in as Org Admin. Two events exist under the same org.",
   "Event with override OFF shows base price plus separate fees. Other org events still show all-in pricing.",
   [["Go to Org Settings. Find All-In Pricing and enable it. Save.","All-In Pricing is ON for the entire org."],
    ["Open a specific event. Go to Configuration, Settings. Set All-In Pricing to OFF for this event. Save.","Event-level override is saved."],
    ["Open the public listing and checkout page for the overridden event.","Base ticket price shown without fees. Fees appear as a separate line item on checkout."],
    ["Open the public listing for the second event with no override.","This event still shows the all-in price since the org default is active."]]],
  [1020,"TC-020 Promo code input appears above checkout button on mobile","Checkout and Payments","Critical","Bob",true,
   "Mobile device or Chrome DevTools set to mobile viewport. Public checkout URL available.",
   "Promo code input field is positioned above the main checkout button. No scrolling past the button is needed.",
   [["On a mobile device or in Chrome DevTools mobile mode open the public event checkout URL.","Page loads in a mobile-friendly layout."],
    ["Add a ticket and proceed to the checkout page.","Checkout page loads in a stacked mobile layout."],
    ["Without scrolling locate both the promo code input field and the main checkout button.","Promo code input is ABOVE the checkout button. No scrolling needed to see it."]]],
  [1021,"TC-021 Scan valid ticket Entry Scan online","Snap Entry","Critical","Bob",true,
   "Snap Entry installed on an iOS or Android test device. Logged in with gatekeeper credentials. Valid ticket QR code available.",
   "Green success screen appears. Holder name and ticket type display correctly. Scan recorded with correct timestamp.",
   [["Open Snap Entry. Log in with gatekeeper credentials.","Login succeeds. List of assigned events appears."],
    ["Tap on the test event from the list.","Event opens in scanning mode."],
    ["Make sure Entry Scan tab is selected. Point the camera at the valid ticket QR code.","Camera activates and begins scanning."],
    ["Hold the QR code steady until scanned.","Green success screen appears. Holder name correct. Ticket type correct."],
    ["On a computer go to the event Attendees page in the admin dashboard.","Check-in is recorded with the correct timestamp."]]],
  [1022,"TC-022 Scan already-checked-in ticket","Snap Entry","Critical","Bob",true,
   "A valid ticket QR code has already been scanned once. Snap Entry is in Entry Scan mode.",
   "Second scan shows an orange or yellow Already Checked In screen. Original check-in time is shown. No duplicate check-in created.",
   [["Scan a valid QR code. Confirm the green success screen appears.","First scan succeeds."],
    ["Immediately scan the same QR code again.","Orange or yellow Already Checked In screen appears. Original check-in time is displayed. No duplicate entry created."]]],
  [1023,"TC-023 Scan revoked ticket rejected","Snap Entry","Critical","Bob",true,
   "A ticket has been revoked via Attendee Detail in the admin dashboard. The revoked QR code is available.",
   "Snap Entry shows a red rejection screen. No check-in recorded. App returns to scan-ready state.",
   [["Confirm the ticket is revoked in the admin dashboard. Navigate to Entry Scan in Snap Entry.","Ticket is confirmed as revoked. Snap Entry ready to scan."],
    ["Scan the QR code of the revoked ticket.","Red rejection screen appears with a clear message. No check-in recorded."],
    ["Dismiss the result screen.","App returns to the live camera scanning state."]]],
  [1024,"TC-024 Cross-channel web check-in blocks Snap Entry re-scan","Snap Entry","Critical","Bob",true,
   "A ticket has NOT been checked in yet. Access to both admin dashboard and Snap Entry on mobile. Regression fixed in October 2025.",
   "After marking a ticket Checked In via the web Snap Entry shows Already Checked In instead of green. No duplicate check-in created.",
   [["In admin dashboard go to Attendees, find an unchecked ticket, open Attendee Detail, and manually mark it as Checked In.","Web dashboard shows the ticket as Checked In."],
    ["On the mobile device open Snap Entry and scan the same ticket QR code in Entry Scan mode.","Snap Entry shows Already Checked In, not a green success. No duplicate check-in entry created."]]],
  [1025,"TC-025 Scan ticket for wrong venue rejected","Snap Entry","Critical","Bob",true,
   "An event has at least two venues. A ticket is assigned to Venue A only. Snap Entry open on a test device.",
   "Scanning a Venue A ticket at Venue B results in a red rejection. Switching to Venue A and scanning results in green success.",
   [["In Snap Entry use the venue dropdown to switch the active venue to Venue B.","Venue B is now the active venue on the scan screen."],
    ["Scan the QR code of the ticket assigned to Venue A only.","Red rejection screen appears. Message says ticket is not valid for this venue."],
    ["Switch the active venue to Venue A using the dropdown. Scan the same ticket again.","Green success screen appears. Check-in recorded for Venue A."]]],
  [1026,"TC-026 Switch Entry Exit tabs no UI freeze","Snap Entry","Critical","Bob",true,
   "Snap Entry open on an Android test device. Covers Android regression TIX-1173. A valid ticket is available.",
   "Both tabs respond immediately. Venue dropdown responds correctly. Camera resumes scanning without freezing.",
   [["Scan any valid ticket in the Entry Scan tab. Wait for the result screen.","Result screen appears."],
    ["Tap the Exit Scan tab.","App switches to Exit Scan immediately. No delay or freeze."],
    ["Tap back to Entry Scan.","App switches back immediately. Camera reactivates and is ready to scan."],
    ["Use the venue dropdown to change to a different venue.","Dropdown responds immediately. Venue updates correctly."]],
   [["Jira","https://jira.company.com/browse/TIX-1173"]]],
  [1027,"TC-027 Access codes auto-created when venue added","Snap Entry","High","Alice",false,
   "An existing event is open in the admin dashboard. Snap Entry installed on a test device. Covers a February 2026 regression fix.",
   "After adding a new venue via the web it appears in Snap Entry venue dropdown. Access code auto-available. Scanning works without manual setup.",
   [["In the admin dashboard open an event, go to Venues tab, click Add Venue, fill in details, and save.","New venue is added to the event."],
    ["On the test device open Snap Entry and navigate to the same event. Check the venue dropdown.","New venue appears in the dropdown."],
    ["Select the new venue and scan a valid ticket.","Snap Entry accepts the scan without errors."]]],
  [1028,"TC-028 Snap Entry with no venues no crash","Snap Entry","High","Alice",false,
   "A test event exists with NO venues added. Snap Entry installed on a test device.",
   "App does not crash or freeze. Clear message explains no venues are set up. A path to configure venues is provided.",
   [["Create a test event with no venues. Make sure it is visible to the gatekeeper account.","Test event exists with no venues."],
    ["On the test device open Snap Entry, log in, and navigate to the no-venue event.","App does not crash or show a blank screen. A clear guidance message is shown."]]],
  [1029,"TC-029 Offline scans sync on reconnect","Snap Entry","Critical","Bob",true,
   "Snap Entry is open and showing a green online indicator. 10 valid ticket QR codes are ready. Airplane mode can be toggled.",
   "Offline mode notice appears when disconnected. All 10 scans record locally. On reconnect all 10 sync. No scans lost or duplicated.",
   [["Confirm Snap Entry shows an online indicator. Enable Airplane Mode on the device.","Offline mode banner appears in Snap Entry."],
    ["Scan 10 different valid ticket QR codes one by one while in airplane mode.","All 10 scans record locally. Pending scan counter shows 10."],
    ["Turn off Airplane Mode and wait for the device to reconnect.","Sync starts automatically. Pending counter counts down."],
    ["On a computer go to the event Attendees page.","All 10 scans appear with correct timestamps. No scans missing or duplicated."]]],
  [1030,"TC-030 Offline scan limit 30 plus scans sync correctly","Snap Entry","Critical","Bob",true,
   "31 valid ticket QR codes available. Device can be put in airplane mode. Covers bug TIX-1035 where scans beyond the 25th were lost.",
   "All 31 scans recorded and sync correctly. Nothing lost after the 25th scan. Web Attendees shows all 31 check-ins.",
   [["Enable Airplane Mode. Scan all 31 valid ticket QR codes in Snap Entry.","All 31 scans recorded locally. Pending counter shows 31."],
    ["Turn off Airplane Mode and wait for sync to complete.","Sync completes. No errors appear in the app."],
    ["On a computer check the event Attendees page and count the check-ins.","All 31 scans appear including 26th through 31st. No scans missing or duplicated."]],
   [["Jira","https://jira.company.com/browse/TIX-1035"]]],
  [1031,"TC-031 Tap-to-Pay disabled offline","Snap Entry","Critical","Bob",true,
   "Snap Entry open on a compatible iPhone XS or newer running iOS 16.4 or later. Airplane mode can be toggled.",
   "When offline Tap-to-Pay is disabled or hidden. Clear message explains unavailability. Cash payment option remains available.",
   [["Open Snap Entry and go to Sell mode.","Sell mode open. Payment options including Tap-to-Pay and Cash are visible."],
    ["Enable Airplane Mode on the iPhone.","Device is now offline."],
    ["In Sell mode add a ticket to the cart and check available payment options.","Tap-to-Pay button is greyed out or hidden. Message explains unavailable offline. Cash option is still active."]]],
  [1032,"TC-032 External card reader disabled offline","Snap Entry","Critical","Bob",true,
   "An external Stripe card reader was connected while the device was online. Airplane mode can be toggled.",
   "When offline the external reader option is disabled with a clear message. App does not crash. Cash payment accessible.",
   [["While online confirm the external reader is connected. Enable Airplane Mode.","Device is offline."],
    ["In Snap Entry Sell mode add a ticket and attempt to pay with the external reader.","External reader option is disabled or hidden. Message explains not available offline. App does not crash. Cash is still available."]]],
  [1033,"TC-033 Offline cash sale syncs to accounting","Snap Entry","High","Alice",false,
   "Snap Entry in Sell mode. A 25 dollar ticket is available. Device can be put in airplane mode.",
   "Change due of 5 dollars shown correctly. Cash transaction queued offline. On reconnect it syncs and appears in Accounting with payment method cash.",
   [["Enable Airplane Mode. Open Snap Entry Sell mode. Add a 25 dollar ticket. Select Cash as payment method.","Cash payment screen opens."],
    ["Enter 30 dollars as the amount tendered.","Change due shows 5 dollars."],
    ["Confirm the sale.","Transaction saved locally. Offline pending counter increments."],
    ["Turn off Airplane Mode and wait for reconnection.","Cash transaction syncs to the server."],
    ["On a computer go to the event Accounting page.","Cash transaction appears with payment method cash and amount 25 dollars."]]],
  [1034,"TC-034 Reader connect disconnect blocked offline","Snap Entry","High","Alice",false,
   "External Stripe reader is connected. Device can be put offline. Covers a January 2026 regression fix.",
   "While offline disconnect and reconnect actions are prevented. No frozen screen. Message explains connectivity required.",
   [["Confirm reader is connected while online. Enable Airplane Mode.","Device is offline."],
    ["Go to reader settings in Snap Entry. Try to tap Disconnect.","Action is prevented. Message says reader management requires connectivity. Screen does not freeze."],
    ["Try to tap Connect.","Also prevented with a similar message. App remains stable and responsive."]]],
  [1035,"TC-035 Tap-to-Pay standard sale online","Snap Entry","Critical","Bob",true,
   "Snap Entry on a compatible iPhone XS or newer, iOS 16.4 or later. Device is online. Physical test card or NFC device available.",
   "Payment processes successfully. Transaction recorded in Event Accounting. Ticket issued. Cart clears automatically.",
   [["Open Snap Entry on the iPhone and go to Sell mode.","Sell mode open and device is online."],
    ["Select a ticket type and add to cart. Tap the Tap-to-Pay button.","iPhone Tap-to-Pay interface activates showing instructions to present a card."],
    ["Hold a physical test card or NFC-enabled device near the back of the iPhone.","Payment processes. Success screen appears in Snap Entry."],
    ["Check the event Accounting page in the admin dashboard.","Transaction appears with correct amount. Ticket is issued. Cart was automatically cleared."]]],
  [1036,"TC-036 Tap-to-Pay cancel no charge returns to cart","Snap Entry","Critical","Bob",true,
   "Snap Entry in Sell mode on a compatible iPhone. Ticket in cart and Tap-to-Pay initiated. Covers a regression fixed in August 2025.",
   "Tapping Cancel immediately cancels the transaction. No charge in Stripe. Cart items preserved. App does not freeze.",
   [["In Snap Entry Sell mode add a ticket to the cart and tap Tap-to-Pay.","Tap-to-Pay interface is active waiting for a card."],
    ["While the payment terminal screen is active tap Cancel.","Session cancelled immediately. Returned to sell screen. Ticket still in cart. App fully responsive."],
    ["Check the Stripe test dashboard.","No new charge or authorization for this cancelled transaction."]]],
  [1037,"TC-037 External Stripe reader connects and processes payment","Snap Entry","Critical","Bob",true,
   "Snap Entry in Sell mode. A Stripe external card reader is available and powered on. Device is online.",
   "Reader connects successfully. Payment processes. Transaction recorded in Stripe and Event Accounting. Cart clears after payment.",
   [["In Snap Entry Sell mode tap Connect Reader. A list of available readers appears.","App discovers the nearby Stripe reader."],
    ["Tap the reader in the list and wait for connection to complete.","Connection confirmation appears. Reader shows as Connected."],
    ["Add a ticket to the cart. Select External Reader and initiate payment. Present a test card.","Reader processes the payment. Success message appears."],
    ["Check the Stripe test dashboard and the Event Accounting page.","Transaction appears in Stripe with correct amount. Cart in Snap Entry is cleared."]]],
  [1038,"TC-038 Connect button disabled during connection","Snap Entry","High","Alice",false,
   "Snap Entry reader settings accessible. Stripe reader available. Covers a December 2025 fix.",
   "While connecting the Connect button is disabled so it cannot be tapped again. No duplicate connection state triggered.",
   [["In Snap Entry go to reader settings and tap Connect Reader to start a connection.","App begins connecting to the reader."],
    ["While connecting observe the Connect button. Try tapping it again.","Button is visibly disabled or greyed out. Tapping again does nothing."],
    ["Wait for the connection to complete.","Connection result shown clearly: success or failure. UI is in a clean stable state."]]],
  [1039,"TC-039 Season Pass wizard shows included tickets ON when editing","Season Passes","Critical","Bob",true,
   "A Season Pass has been created covering 3 events with 1 ticket type enabled per event. Covers a regression where re-editing showed included tickets as OFF.",
   "When re-opening the wizard all 3 previously included ticket toggles show as ON. Re-saving without changes does not remove any tickets.",
   [["Create a Season Pass covering 3 events. Enable the ticket type for each. Save the pass.","Season Pass saved with all 3 events and ticket types."],
    ["Navigate back to the Season Pass and click Edit. Go to the ticket selection step.","All 3 ticket toggles show in the ON position. None appear as OFF."],
    ["Click Save or Finish without making any changes.","Pass saved again. All 3 events and ticket types still included."]]],
  [1040,"TC-040 Soft-deleted Season not in dashboards or accounting","Season Passes","Critical","Bob",true,
   "A Season exists with at least 1 event and 1 completed sale. Org Admin access available.",
   "After soft-deleting the Season disappears from all views. Data is preserved in the database.",
   [["Find the delete option in Season settings and soft-delete the Season. Confirm.","Season is soft-deleted."],
    ["Go to the main Seasons list.","Deleted Season no longer appears."],
    ["Check the main Dashboard summary counts.","Event and revenue counts exclude the deleted Season."],
    ["Go to the Season Accounting page.","Deleted Season transactions not shown. Revenue excluded from totals. Data still exists in the database as a soft delete."]]],
  [1041,"TC-041 Season checkout does not error on deleted ticket types","Season Passes","Critical","Bob",true,
   "A Season Pass covers an event that originally had 2 ticket types. One has been deleted.",
   "Season Pass checkout loads without errors. Only the active ticket type is shown. Purchase completes successfully.",
   [["In the admin dashboard go to the event within the Season and delete one of its 2 ticket types.","Ticket type deleted. Event now has 1 active ticket type."],
    ["Open the Season Pass public checkout URL in a browser.","Page loads without any errors."],
    ["Check the ticket options available.","Only the 1 active non-deleted ticket type is shown."],
    ["Complete the purchase with the test card.","Purchase succeeds. Confirmation page and email received."]]],
  [1042,"TC-042 Season Accounting handles more than 50 transactions","Season Passes","High","Alice",false,
   "A Season Pass event has more than 50 completed transactions. Covers a known regression where counts were capped at 50.",
   "All transactions counted correctly. Revenue reflects all transactions. Page loads without timeout or error.",
   [["Navigate to the Season Accounting page for the season with 50 or more transactions.","Page loads without timeout or error."],
    ["Scroll to the bottom of the transaction table. Check the total count.","Count is greater than 50. Total is NOT capped at 50."],
    ["Check the Total Revenue figure.","Revenue reflects ALL transactions, not just the first 50."]]],
  [1043,"TC-043 Season Passholder searchable by Order Number","Season Passes","High","Alice",false,
   "An active Season has passholders. You have a known Order Number for one of them.",
   "Searching by Order Number returns the correct passholder with no unrelated results.",
   [["Go to the Season Passholders page for an active season.","Passholders list loads."],
    ["In the search bar type the known Order Number.","Only the passholder with that Order Number appears. No unrelated passholders shown."]]],
  [1044,"TC-044 Processing fee shows actual Stripe fee","Accounting and Reporting","Critical","Bob",true,
   "A test purchase has been completed. Stripe webhook is active. This is a February 2026 feature.",
   "Processing fee displayed equals the actual Stripe fee. Consistent across Event Dashboard, Org Accounting, and Season Accounting.",
   [["Complete a test purchase. Wait 10 to 30 seconds for the Stripe webhook to fire.","Purchase complete and webhook has had time to process."],
    ["Go to Event Dashboard Accounting tab. Find the transaction and look at the Processing Fee column.","Fee shown is the actual Stripe fee amount, not a pre-estimated figure."],
    ["Check the Org Accounting page for the same transaction.","Processing fee shown is identical to what was shown on the Event Dashboard."]]],
  [1045,"TC-045 Gross Revenue column shows Gross not Net","Accounting and Reporting","Critical","Bob",true,
   "Accounting page for an event with completed sales is accessible. Covers active bug TIX-1292.",
   "Gross Revenue column shows full sale amounts before deductions. Correctly labeled Gross Revenue not Net Revenue.",
   [["Navigate to the Accounting page for any event with completed sales.","Accounting page loads with the transactions table."],
    ["Look at the column headers. Find the Gross Revenue column.","Column is labeled Gross Revenue not Net Revenue. Values show the full sale amount before fees or refunds."],
    ["Find the Net Revenue column.","A separate Net Revenue column exists with lower values. Both columns clearly labeled and showing different values."]],
   [["Jira","https://jira.company.com/browse/TIX-1292"]]],
  [1046,"TC-046 Event Dashboard tabs load correctly","Accounting and Reporting","Critical","Bob",true,
   "An event with completed sales and check-ins exists. Covers a February 2026 dashboard restructure.",
   "All 3 sub-tabs load without errors. Full ticket names shown. Columns align correctly. Fee breakdown tooltips render correctly.",
   [["Open an event with sales and check-ins. Click the Event Dashboard tab.","Event Dashboard loads."],
    ["Click the Daily Check-In sub-tab.","Tab loads without errors. Check-in data is displayed."],
    ["Click the Ticket Type Overview sub-tab.","Tab loads. Revenue by Ticket Type table shows full ticket type names without truncation. Columns align correctly."],
    ["Click the Venue Breakdown sub-tab.","Tab loads with data. No blank state or errors."],
    ["If Sales Tax is enabled hover over a fee breakdown tooltip in any tab.","Tooltip renders correctly and shows the complete fee breakdown."]]],
  [1047,"TC-047 Revenue metrics correct after event date edit","Accounting and Reporting","High","Alice",false,
   "An event has completed ticket sales and recorded check-ins. Event start date can be edited.",
   "After changing the event date check-in metrics reset to reflect new date context. Revenue data remains fully intact.",
   [["Note the current check-in count and revenue figures from the Event Dashboard.","You have a baseline of current metrics."],
    ["Go to event Settings or Edit page. Change the event start date by 1 day. Save.","Event date updated successfully."],
    ["Return to the Event Dashboard and check check-in metrics.","Check-in metrics have reset to reflect the new date. This is expected behavior."],
    ["Check the Revenue figures on Event Dashboard and Accounting page.","Revenue data is fully intact. Same total revenue as before. Nothing was lost or reset."]]],
  [1048,"TC-048 CSV export includes all required columns","Accounting and Reporting","High","Alice",false,
   "An event exists with completed sales, at least one used promo code, recorded check-ins, and configured metadata fields.",
   "CSV export includes all required columns. Metadata fields appear as additional columns. Exporting with no transactions shows a clear error.",
   [["Go to the event Attendees page. Click the Export CSV button.","CSV file downloads."],
    ["Open the CSV in Excel or Google Sheets. Check for these columns: Check-In Status, Discount Amount, Sales Tax, Fees, Refunds, Net Revenue.","All 6 listed columns are present with correct data."],
    ["Check if configured metadata fields appear as additional columns.","Each metadata field appears as its own column with correct attendee values."],
    ["Find an event with NO completed transactions. Try to export its CSV.","A clear error message is shown explaining there are no transactions to export."]]],
  [1049,"TC-049 Soft-delete event removed from all views data preserved","Ticket Management","Critical","Bob",true,
   "An event exists with at least 1 completed ticket sale. This is a February 2026 feature.",
   "After soft-deleting the event disappears from Events list, Season Pass wizard, and Dashboard count. Transaction data preserved.",
   [["Go to event settings and soft-delete the event. Confirm.","Event is soft-deleted."],
    ["Go to the main Events list.","Deleted event does not appear."],
    ["Open the Season Pass wizard and go to the Add Events step.","Deleted event does NOT appear in the list."],
    ["Check the main Dashboard event count.","Count decreased by 1. Revenue and transaction data still preserved in the database."]]],
  [1050,"TC-050 Venue setup prompt when no venue configured","Ticket Management","High","Alice",false,
   "A new event exists with NO venues added. Covers a regression fix.",
   "When trying to add a ticket on an event with no venues a Set Up Venues prompt appears with a direct link. No blank or broken state shown.",
   [["Create a new event with no venues. Navigate to the event Tickets tab.","Tickets tab opens. No tickets can be created yet."],
    ["Click the Add Ticket button.","A prompt appears with a direct link to venue setup. No blank page or broken form."],
    ["Click the link in the prompt.","You are taken directly to the Venues configuration page for this event."]]],
  [1051,"TC-051 Deleting venue with sales each ticket shown once","Ticket Management","High","Alice",false,
   "A venue exists with at least 2 different ticket types that have sales. You are about to delete this venue.",
   "Deletion confirmation modal lists each affected ticket type exactly once. No duplicates. Deletion completes without a server error.",
   [["Go to the event Venues tab. Click Delete or Remove next to the venue with sales.","A confirmation modal appears listing affected ticket types."],
    ["Look at the list of affected ticket types in the modal.","Each ticket type appears exactly once. No duplicates."],
    ["Confirm the deletion.","Venue is deleted. Success message appears. No 500 error occurs."]]],
  [1052,"TC-052 Gatekeeper accesses only assigned events","Authentication","Critical","Bob",true,
   "A user account exists with the snap_gatekeeper role assigned to some events but NOT all events in the organization.",
   "Gatekeeper only sees assigned events. Unassigned events not accessible. No access to org settings or attendee data outside scan screens.",
   [["Open Snap Entry and log in using the gatekeeper credentials.","Login succeeds. List of assigned events appears."],
    ["Look at the event list.","Only events assigned to this gatekeeper are visible. Unassigned events do not appear."],
    ["Try to access an event not assigned to this gatekeeper.","Access is blocked. No unassigned events can be viewed."],
    ["Look for any links to org settings, billing, or full attendee data.","No such options are accessible. View is restricted to scan functionality only."]]],
  [1053,"TC-053 Non-admin redirected before admin hub loads","Authentication","Critical","Bob",true,
   "You have login credentials for a standard org member (not an admin). You know the internal admin hub URL (typically at /admin or /hub path on the platform domain).",
   "User is redirected before any admin content is displayed. No partial admin data visible. User lands on org dashboard or a 403 page.",
   [["Log in using the standard org member credentials.","Logged in and on the normal user dashboard."],
    ["In the browser address bar manually type the admin hub URL and press Enter.","Page immediately redirects. No admin content ever visible during the redirect."],
    ["Check where you ended up after the redirect.","You are on the normal org dashboard or a 403 Unauthorized page. No admin data was exposed."]]],
  [1054,"TC-054 Org Accounting loads for org admin no 500","Authentication","Critical","Bob",true,
   "You have login credentials for an Org Admin account (NOT a Fastbreak internal admin). Covers a regression in Row Level Security area TIX-1191.",
   "Org Accounting page loads successfully with org-level revenue data. No 500 error. Only org own data visible.",
   [["Log in using Org Admin credentials (the admin of your specific organization).","Logged in to the org admin dashboard."],
    ["Navigate to Org then Accounting.","Org Accounting page loads successfully. Revenue data displayed. No 500 error."],
    ["Review the data shown.","Only your organization data shown. No data from other organizations visible."]],
   [["Jira","https://jira.company.com/browse/TIX-1191"]]],
  [1055,"TC-055 New org member can invite staff in same session","Authentication","High","Alice",false,
   "A new org member invitation email has been sent. You will accept it and complete onboarding. Covers a regression fix.",
   "After completing onboarding the new member can immediately invite additional staff. Invitation sent successfully. Invited staff receives the email.",
   [["Open the org invitation email and click the acceptance link. Complete the onboarding flow.","Onboarding complete. Logged in as the new org member."],
    ["WITHOUT logging out navigate to Org Settings then Staff.","Staff settings page loads. Existing team members visible."],
    ["Click Invite Staff Member. Enter a valid email address. Click Send Invitation.","Invitation sent. Success message appears. No permission-denied or authentication error."],
    ["Check the inbox of the email address you invited.","Invited staff receives an invitation email with instructions to join the organization."]]],
  [1057,"TC-057 Biometric payment failure — no orphaned collection on decline","Checkout and Payments","Critical","Alice",true,
   "Event has biometrics enabled (is_biometric_required = true). A biometric collection has been created in fb_biometrics.biometric_collections. User has a valid ticket in cart and reaches the payment step.",
   "If payment fails, no admission_ticket or face_search_request record is created. The biometric_collection is not corrupted. The user can retry checkout and complete it successfully.",
   [["Add a biometric-enabled ticket to cart and proceed through checkout to the payment step. Enter contact info and name as required.","Checkout form loads correctly. Biometric warning card is shown. Contact fields are visible and required."],
    ["Enter a card number that will trigger a payment decline (e.g. test card 4000000000000002). Submit payment.","Payment is declined. An error message is shown to the user. Checkout does not advance."],
    ["In the admin dashboard go to the Attendees page for the event. Look for a new attendee record tied to this failed transaction.","No new attendee record appears in the Attendees list. The order is not created. The biometric collection for the event is unchanged."],
    ["Re-enter a valid card number and submit payment.","Payment succeeds. Order is created. Confirmation page loads."],
    ["Go to the Attendees page and confirm exactly one new attendee record exists. Refresh the page to verify no duplicates appear.","Exactly one order and one attendee record exist for this purchase. No duplicate entries from the failed payment attempt."]],
   [["Jira","https://jira.company.com/browse/TEAM-000"]]],
  [1058,"TC-058 Biometric event — forced metadata required before payment","Checkout and Payments","Critical","Alice",true,
   "Event has biometrics enabled and at least one metadata field has is_forced = true (e.g. First Name, Last Name). User is logged in and has a ticket in cart. fb_eet.event_metadata_fields records exist for this event.",
   "User cannot reach the payment step without completing all forced metadata fields. Attempting to skip them is blocked server-side, not just client-side.",
   [["Proceed to checkout. When the contact/metadata form is shown, leave all is_forced fields blank and attempt to continue.","Form submission is blocked. Validation errors are shown for each required field. User cannot proceed to payment."],
    ["Using browser dev tools Network tab, observe the form submission request. Confirm the server also rejects empty forced fields by checking the Attendees page for any new record.","Server rejects the submission. No new order or attendee record is created. Network response shows an error status (4xx)."],
    ["Fill in all forced metadata fields with valid values (First Name, Last Name, DOB) and submit the form normally.","Form validation passes. User advances to the payment step."],
    ["Complete payment with a valid card.","Order is created successfully. Confirmation page and email received. Attendee Detail in the admin dashboard shows the submitted metadata values."]],
   [["Jira","https://jira.company.com/browse/TEAM-000"]]],
  [1059,"TC-059 Forced metadata fields read-only in Order Management post-purchase","Checkout and Payments","Critical","Bob",true,
   "A completed order exists for a biometric event. The event has at least one metadata field with is_forced = true and is_deleted = false. User has Order Management (OM) access.",
   "Forced metadata fields are read-only in OM for standard orders. They may only be editable for transfer flows if that is the intended design decision.",
   [["Open the completed order in Order Management. Navigate to the attendee metadata section.","Forced metadata fields (e.g. First Name, Last Name) are visible."],
    ["Attempt to edit a forced metadata field value in OM and save.","Edit action is blocked and a warning or error message is shown. The field value is not changed."],
    ["Initiate a ticket transfer for the same order. Open the transfer form and check if forced metadata fields are editable.","Forced fields are editable in the transfer form, allowing the new attendee to provide their own identity details."],
    ["Complete the transfer with updated metadata.","Transfer completes. New attendee receives a ticket confirmation email. Attendee Detail shows the updated metadata. The original ticket is marked as transferred or voided."]],
   [["Jira","https://jira.company.com/browse/TEAM-000"]]],
  [1060,"TC-060 Check-in blocked when no ID uploaded — upload link dispatched","Checkout and Payments","Critical","Charlie",true,
   "Event has is_biometric_required = true. An admission_ticket exists where biometric_image_id is NULL (attendee never uploaded their ID). Attendee arrives at the gate and scans their QR code in SnapEntry.",
   "Attendee is blocked from check-in. System automatically sends an upload link via email/SMS. Staff sees a clear error state in SnapEntry.",
   [["Scan the attendee QR code in SnapEntry.","SnapEntry detects that the ticket requires a biometric ID upload but none has been submitted. A red or failure state is shown immediately."],
    ["Observe the SnapEntry UI response after the QR scan.","A red or failure state is shown. Message indicates the ticket required ID upload but no ID was uploaded. Check-in is not granted."],
    ["Confirm whether the upload link is automatically dispatched or requires staff action. Check the attendee email and SMS for the upload link.","Upload link is sent automatically or can be triggered by staff. Link arrives within 60 seconds. Link is unique to this specific ticket."],
    ["Attempt to manually check in the attendee from SnapEntry without the ID being uploaded.","Manual check-in without the ID upload is not permitted. No successful check-in record is created."],
    ["Attendee uses the upload link to upload a valid ID photo. Return to SnapEntry and re-scan the QR code.","ID upload is processed. On match, SnapEntry shows the green success state and check-in succeeds."]],
   [["Jira","https://jira.company.com/browse/TEAM-000"]]],
  [1061,"TC-061 Face scan no_match — staff override allowed and logged","Checkout and Payments","Critical","Charlie",true,
   "Event has biometrics enabled. Attendee has a valid ticket with a biometric_image_id populated. Attendee is physically present at the gate. SnapEntry is in biometric check-in mode.",
   "On a no_match result, SnapEntry shows the indexed photo for staff comparison and allows a manual check-in decision. The override action is recorded in fb_eet.admission_ticket_scans.",
   [["Scan the attendee face using the SnapEntry camera.","SnapEntry initiates face recognition. A face search request is sent for this ticket."],
    ["Have someone other than the ticket holder present their face to the SnapEntry camera, or use a blurry or partially obscured image to trigger a low-confidence result.","SnapEntry does not auto-approve. A no-match result screen is shown. The photo on file for the ticket holder is displayed to staff for visual comparison."],
    ["Staff visually compares the displayed photo to the attendee and clicks the manual check-in or override button.","Manual check-in succeeds. SnapEntry shows a success or override-confirmed state. The check-in is recorded and visible on the Attendees page in the admin dashboard."],
    ["Attempt to check in the same ticket a second time (replay attack or double entry).","SnapEntry detects the ticket has already been scanned. Entry is denied. No duplicate check-in record is created."]],
   [["Jira","https://jira.company.com/browse/TEAM-000"]]],
  [1062,"TC-062 Concurrent first purchases do not duplicate biometric collection","Checkout and Payments","Critical","Dana",true,
   "Event has biometrics enabled. No biometric_collections record exists yet for this event_id. Two users purchase tickets for the same event concurrently or in quick succession.",
   "Exactly one fb_biometrics.biometric_collections record exists per event. Concurrent first purchases do not create duplicate collections. All subsequent tickets are indexed into the same collection.",
   [["Open two separate browser sessions (e.g. Chrome and Firefox) and begin checkout for the same biometric event simultaneously. Complete both purchases as close together as possible.","Both purchases complete. Confirmation pages and emails received for both buyers."],
    ["Go to the admin dashboard event settings or biometric configuration page for the target event.","The event shows exactly one biometric collection configured. No error state or duplicate collection warning is visible."],
    ["Purchase a third ticket for the same event independently.","Third purchase completes successfully. Confirmation email received. No errors during checkout."],
    ["Have all three ticket holders attempt check-in via SnapEntry biometric scan at the event.","All three attendees check in successfully using face recognition. No errors or collection mismatch messages appear. All check-ins appear on the Attendees page."]],
   [["Jira","https://jira.company.com/browse/TEAM-000"]]],

  [1063,"TC-063 Create a new event end-to-end","Event Management","Critical","Bob",true,
   "Logged in as Org Admin on tickets.fastbreak-dev.ai. No event exists yet for this test run.",
   "Event appears in the Events list with correct name, dates, and timezone. Public checkout URL is accessible. Banner image displays correctly.",
   [["Go to the admin dashboard. In the left sidebar click Events, then click Create Event.","The event creation form opens."],
    ["Fill in: Event Name = Summer Fest 2026, Start Date = any future date, End Date = 2 days later, Timezone = America/New_York.","All fields accept input. No validation errors shown."],
    ["In the Description field type a short description (up to 100 characters).","Text is accepted with no errors."],
    ["Upload a banner image (any JPEG under 5 MB). If a cropping tool appears, adjust it and click Apply.","Banner image previews correctly in the form."],
    ["Click Add Venue. Enter a venue name (e.g. Main Stage). Save the venue.","Venue appears attached to the event."],
    ["Click Save or Create Event.","Success message appears. You are taken to the event detail page."],
    ["In the left sidebar click Events to return to the Events list.","The new Summer Fest 2026 event appears with the correct dates."],
    ["Open the event, find the Public Checkout URL (usually in Overview or Settings), and open it in a new browser tab.","Checkout page loads. Event name, dates, and banner image display correctly."]]],
  [1064,"TC-064 Exit scan records departure and re-entry allowed after exit","Snap Entry","Critical","Bob",true,
   "Snap Entry installed on a test device. A ticket has already been checked in (green entry scan completed). Exit Scan is enabled for the event.",
   "Exit is recorded with a timestamp. A second entry scan succeeds after the exit. The admin dashboard shows both entry and exit events.",
   [["Open Snap Entry and navigate to the test event. Tap the Exit Scan tab.","Exit Scan tab is active. Camera is ready."],
    ["Scan the QR code of the already-checked-in attendee.","Exit scan result screen appears confirming the attendee has exited."],
    ["On a computer open the event Attendees page in the admin dashboard. Find this attendee.","Attendee record shows both an entry event and an exit event with timestamps."],
    ["In Snap Entry switch back to the Entry Scan tab. Scan the same QR code again.","Green success screen appears, allowing re-entry. A new check-in is recorded."],
    ["Refresh the Attendees page in the admin dashboard and check the attendee record.","Two entry events and one exit event are visible. All timestamps are in correct chronological order."]]],
  [1065,"TC-065 Ticket transfer declined by recipient — original ticket stays active","Ticket Management","High","Alice",false,
   "A ticket has been purchased. A second email address is available to receive the transfer request. Snap Entry is available on a test device.",
   "Original ticket remains valid and scannable with the original holder. No transfer is recorded. The second email address receives no ticket.",
   [["In the admin dashboard go to Attendees, find the ticket, open Attendee Detail.","Attendee Detail shows ticket as active."],
    ["Click Transfer Ticket. Enter the second email address. Click Confirm.","Transfer request is sent. The second email address receives a transfer notification email."],
    ["Open the transfer email in the second inbox. Click the Decline link or button.","A confirmation page loads stating the transfer was declined."],
    ["In the admin dashboard return to the original order in Attendees. Check the ticket status.","Ticket status is still Active (not transferred). The original holder still owns the ticket."],
    ["Scan the original QR code in Snap Entry.","Green success screen appears. The original holder can check in successfully."]]],
  [1066,"TC-066 All-In Eat Fees — buyer sees single price with no separate fee line item","Checkout and Payments","Critical","Bob",true,
   "Logged in as Org Admin. All-In Pricing (Eat Fees) is enabled at the org or event level. A ticket is priced at $30.00. Test card: 4242 4242 4242 4242, expiry 12/34, CVC 123.",
   "Buyer pays exactly $30.00. No fees appear as a separate line item at checkout. Organizer payout in Stripe reflects the absorbed fee. Accounting confirms fee absorption.",
   [["In the admin dashboard open the event. Go to Configuration, Settings, All-In Pricing or Eat Fees. Confirm it is enabled. Note the ticket price ($30.00).","All-In Pricing is ON. Ticket shows $30.00."],
    ["Open the public checkout URL in a new incognito browser tab.","Checkout page loads. Ticket is listed at $30.00."],
    ["Look carefully at the order summary. Check for any separate fee or service charge line items.","No separate fee line item is shown. The total is $30.00. The buyer sees only one clean price."],
    ["Add the ticket and proceed to payment. Enter the test card details. Complete the purchase.","Payment processes for exactly $30.00. Confirmation page and email received."],
    ["Go to the event Accounting page in the admin dashboard. Find this transaction.","Transaction shows $30.00 gross. The organizer payout is $30.00 minus the actual Stripe processing fee. The buyer was not charged any extra fee on top of $30.00."]],
   [["Jira","https://jira.company.com/browse/TIX-1265"]]],
  [1067,"TC-067 All-In Reverse Price Calculation — organizer sets final price, system back-calculates base","Checkout and Payments","Critical","Bob",true,
   "Logged in as Org Admin. Reverse Price Calculation is enabled on the event. The desired final buyer price is set to $50.00 and saved. Test card: 4242 4242 4242 4242, expiry 12/34, CVC 123.",
   "Buyer pays exactly $50.00. The base ticket price in admin is lower than $50.00. Stripe charge equals $50.00. Accounting shows correct gross and net figures.",
   [["In the admin dashboard open the event. Go to Ticket Types and click Edit on the target ticket. Locate the Final Buyer Price or Reverse Price input. Confirm it is set to $50.00. Note the calculated base price (it should be less than $50.00).","System shows a base price lower than $50.00 (e.g. $47.17). The displayed final price for the buyer is $50.00."],
    ["Open the public checkout URL in a new incognito browser tab.","Checkout page loads. Ticket price displayed to the buyer is $50.00."],
    ["Review the checkout summary. Check if any fees are added on top of $50.00.","Total is $50.00. No additional fees added on top. Any fee breakdown shows fees included within the $50.00, not added above it."],
    ["Complete the purchase with the test card.","Payment processes for exactly $50.00. Confirmation page and email received."],
    ["Go to the event Accounting page. Find this transaction and check the figures.","Gross Revenue shows $50.00. Processing fee is deducted from the organizer payout. The base price back-calculation is accurate."]],
   [["Jira","https://jira.company.com/browse/TIX-1265"]]],
  [1068,"TC-068 Promo code fixed-amount discount applied correctly","Checkout and Payments","High","Alice",false,
   "Logged in as Org Admin. A $50.00 ticket exists on the event. A new promo code with a $10 fixed-amount discount will be created.",
   "$10.00 discount shown as a line item. Fees recalculated on the $40.00 subtotal. Stripe charge matches the discounted total. Usage count increments to 1.",
   [["Go to Event, Promotions, Create Promo Code. Set Code = FLAT10, Discount Type = Fixed Amount, Amount = $10.00, Max Uses = 5. Save.","Promo code FLAT10 is created with Fixed Amount type."],
    ["Open the public checkout in a new incognito tab. Add the $50.00 ticket. Proceed to checkout.","Order summary shows $50.00 subtotal."],
    ["In the promo code field enter FLAT10 and click Apply.","A -$10.00 discount line item appears. The new subtotal shows $40.00. Fees are recalculated on the $40.00 base."],
    ["Complete the purchase with the test card (4242 4242 4242 4242, expiry 12/34, CVC 123).","Payment processes. Stripe charge equals $40.00 plus applicable fees. Confirmation page and email received."],
    ["Go to Event, Promotions and find the FLAT10 code. Check the usage count.","Usage count shows 1 of 5."]]],
  [1069,"TC-069 Expired promo code is rejected at checkout","Checkout and Payments","High","Alice",false,
   "A promo code exists with an End Date set to yesterday. The code has not reached its Max Uses limit.",
   "The expired code is rejected with a clear error message. No discount is applied. The order total is unchanged.",
   [["In the admin dashboard go to Event, Promotions. Create or confirm a promo code with an End Date of yesterday. Note the code name.","Promo code exists with a past end date. Max Uses limit not reached."],
    ["Open the public checkout in a new incognito tab. Add a ticket and proceed to checkout.","Checkout page loads with order summary."],
    ["Enter the expired promo code in the promo code field and click Apply.","A clear error message appears (e.g. This promo code has expired or Code is no longer valid). No discount is applied. The total is unchanged."]]],
  [1070,"TC-070 Inactive ticket type cannot be purchased at checkout","Checkout and Payments","Critical","Bob",true,
   "Logged in as Org Admin. An event has two ticket types: one Active ($25) and one Inactive ($50). The public checkout URL is available.",
   "Only the Active $25 ticket is available at checkout. The Inactive $50 ticket cannot be added to cart or purchased.",
   [["In the admin dashboard go to the event Tickets tab. Find the $50 ticket type. Click Edit. Change its status to Inactive or disable it. Save.","Ticket type is now marked as Inactive."],
    ["Open the public checkout URL in a new incognito browser tab.","Checkout page loads."],
    ["Look at the available tickets on the checkout page.","Only the $25 Active ticket is listed. The $50 Inactive ticket does NOT appear, or is clearly marked as unavailable with no Add to Cart option."],
    ["If the inactive ticket is visible, attempt to add it to the cart.","The action is blocked. You cannot add an inactive ticket to the cart or proceed to payment."]],
   [["Jira","https://jira.company.com/browse/TIX-501"]]],
  [1071,"TC-071 CAD currency checkout displays and charges in Canadian dollars","Checkout and Payments","High","Alice",false,
   "An event is configured with Currency set to CAD and has a ticket priced at CAD $30.00. Test card: 4242 4242 4242 4242.",
   "All checkout amounts show CAD currency. Stripe charges in CAD. Accounting page shows CAD figures.",
   [["Open the public checkout URL for the CAD event in a new incognito browser tab.","Checkout page loads."],
    ["Look at the ticket price and currency symbol displayed.","Price shows CAD $30.00 (or C$30.00). No USD-only symbol shown without a CAD indicator."],
    ["Add the ticket and proceed to the Stripe payment screen.","Stripe payment form shows the charge in CAD."],
    ["Complete the purchase with the test card.","Payment succeeds. Confirmation page and email received showing CAD pricing."],
    ["Go to the admin dashboard Accounting page for the CAD event.","All revenue figures display in CAD. No incorrect USD conversion shown."]]],
  [1072,"TC-072 Admin issues a complimentary ticket at $0 — QR is valid and scannable","Checkout and Payments","High","Alice",false,
   "Logged in as Org Admin. An active event with a paid ticket type exists. A recipient email address is ready.",
   "$0 complimentary ticket is issued. No Stripe charge occurs. Recipient receives ticket by email. QR is valid and scannable in Snap Entry. Accounting shows $0.",
   [["In the admin dashboard navigate to the event Attendees page. Look for an option such as Issue Complimentary Ticket or Add Attendee. Click it.","A form or modal opens for issuing a free ticket."],
    ["Select the ticket type. Enter the recipient email address. Leave the price at $0 (complimentary). Confirm.","Ticket is issued. Success message appears."],
    ["Check the recipient email inbox.","The recipient receives a ticket confirmation email with a View Ticket link and QR code."],
    ["Open the digital ticket from the email. Check the price shown.","Ticket page loads. Price shows $0 or Complimentary. QR code is visible."],
    ["Scan the QR code in Snap Entry.","Green success screen appears. Holder name and ticket type are correct."],
    ["Go to the event Accounting page and find the complimentary ticket entry.","Transaction appears with $0.00 gross revenue. No Stripe charge. Not counted as paid revenue."]]],
  [1073,"TC-073 Season Pass end-to-end purchase — tickets auto-distributed to all events","Season Passes","Critical","Bob",true,
   "A Season exists with 2 events, each with an active ticket type included in the pass. A public Season Pass checkout URL is available. Test card: 4242 4242 4242 4242, expiry 12/34, CVC 123.",
   "Season Pass purchase is recorded. Confirmation email received. Individual tickets are automatically distributed to both events. Buyer appears on the Season Passholders page.",
   [["Open the Season Pass public checkout URL in a new incognito browser tab.","Season Pass checkout page loads. The two included events are listed. Price is correct."],
    ["Add the Season Pass to cart and click Checkout.","You are taken to the payment screen."],
    ["Complete the purchase with the test card.","Payment processes. Confirmation page shown. Confirmation email arrives in the buyer inbox."],
    ["In the admin dashboard go to the Season then Passholders page.","The new buyer appears in the Passholders list with their order number and status."],
    ["Go to Event 1 Attendees page. Search for the buyer email.","The buyer has a ticket in Event 1. It was automatically distributed, not manually added."],
    ["Go to Event 2 Attendees page. Search for the same buyer email.","The buyer also has a ticket in Event 2. Both individual tickets are active and have valid QR codes."]]],
  [1074,"TC-074 Season Passholders CSV export contains all passholders with correct data","Season Passes","High","Alice",false,
   "A Season has at least 3 passholders with completed purchases.",
   "CSV file downloads successfully. Contains one row per passholder. Key columns are present and data matches the web UI.",
   [["In the admin dashboard open the Season and navigate to the Passholders page.","Passholders list loads showing 3 or more entries."],
    ["Click the Export CSV button.","A CSV file downloads to your computer."],
    ["Open the CSV in Excel or Google Sheets. Check for these columns: Name, Email, Order Number, Pass Status, Purchase Date.","All 5 listed columns are present."],
    ["Count the data rows excluding the header.","The row count matches the number of passholders shown on the web page. No passholder is missing."],
    ["Check one row for accuracy: verify name, email, and order number match what the Passholders web page shows.","Data in the CSV matches the web UI exactly."]]],
  [1075,"TC-075 Snap Entry shows ticket metadata on scan result screen","Snap Entry","High","Alice",false,
   "Event has Ticket Metadata configured with at least one field: Ticket Holder Name (Required). A ticket was purchased with value Jordan Lee entered. Snap Entry is updated to the latest build that includes metadata display.",
   "After scanning, the result screen in Snap Entry shows the metadata value Jordan Lee. Staff can read it without opening the web admin dashboard.",
   [["On the test device open Snap Entry. Log in and navigate to the test event. Tap Entry Scan.","Camera is ready to scan."],
    ["Scan the QR code of the ticket purchased with the metadata value Jordan Lee.","Green success screen appears."],
    ["Carefully read the success screen. Look for a metadata section or field labeled Ticket Holder Name.","The success screen shows Jordan Lee (the metadata value entered at checkout). The field label is visible."],
    ["Dismiss the result and return to scan mode.","App returns to the live camera scanning state. No errors."]],
   [["Jira","https://jira.company.com/browse/TIX-1295"]]],
  [1076,"TC-076 Biometric event settings toggle enables biometric requirement at checkout","Checkout and Payments","Critical","Bob",true,
   "Logged in as a Fastbreak internal admin (biometric toggle is behind an FB Internal feature flag). An event exists with biometrics currently disabled.",
   "Enabling the toggle causes the checkout page to show a biometric warning card and required contact fields. Disabling it removes them.",
   [["In the admin dashboard open the event. Navigate to Settings or Security Settings. Look for the Biometric Check-In or Face ID Verification toggle. Confirm it is OFF.","Toggle is visible and currently set to OFF."],
    ["Enable the biometric toggle. Save or confirm.","Toggle changes to ON. A success or confirmation message appears."],
    ["Open the public checkout URL for this event in a new incognito browser tab.","Checkout page loads."],
    ["Look at the checkout form for a biometric warning card or consent notice. Check that First Name and Last Name (or contact info) are now required fields.","Biometric warning card IS visible. Required contact fields are present. These were NOT present before the toggle was enabled."],
    ["Go back to the admin dashboard. Disable the biometric toggle. Save. Open the checkout URL again in a fresh incognito tab.","The biometric warning card is gone. Forced contact fields are no longer required. Checkout looks like a standard event checkout."]],
   [["Jira","https://jira.company.com/browse/TIX-1284"]]],
  [1077,"TC-077 Attendee uploads biometric ID via emailed link and can then check in","Checkout and Payments","Critical","Charlie",true,
   "Event has biometrics enabled. A ticket was purchased but the attendee never uploaded their ID photo. An upload link has been sent to the attendee email (automatically or triggered by staff via the admin dashboard).",
   "Upload link opens correctly. Photo uploads successfully. Attendee Detail shows photo uploaded. SnapEntry check-in succeeds after upload.",
   [["Open the attendee email inbox. Find the email with subject related to ID upload or biometric verification required.","Email has arrived with a unique upload link for this ticket."],
    ["Click the upload link in the email.","A web page opens with instructions and an ID photo upload form."],
    ["Upload a clear, well-lit face photo (a test image is fine). Click Submit or Upload.","Upload succeeds. A confirmation message appears (e.g. Your photo has been received. You are all set for check-in.)."],
    ["In the admin dashboard go to the event Attendees page and open this attendee detail.","Attendee Detail shows that the biometric image has been uploaded (e.g. a status indicator or photo thumbnail is present)."],
    ["On a test device open Snap Entry and scan the attendee QR code in biometric check-in mode.","SnapEntry performs the face match. Green success screen appears. Check-in is recorded."]],
   [["Jira","https://jira.company.com/browse/TIX-1288"]]],
  [1078,"TC-078 Password reset flow completes and new password works","Authentication","Critical","Bob",true,
   "A registered user account exists with a known email address. Access to the email inbox is available.",
   "Password reset email received. New password accepted. User logs in successfully with the new password. Old password no longer works.",
   [["Go to identity.fastbreak.ai (the login page). Enter the registered email. Enter an incorrect password and click Sign In.","Login fails. An error message says Invalid credentials or similar."],
    ["Click the Forgot Password or Reset Password link on the login page.","A password reset form appears asking for your email address."],
    ["Enter the registered email address. Click Send Reset Email or Submit.","A success message appears (e.g. Check your email for a reset link)."],
    ["Open the email inbox. Find the password reset email from Easy Event Tickets or Fastbreak. Click the reset link.","A browser tab opens with a Set New Password form. The link works and does not show an expired or invalid error."],
    ["Enter a new password (e.g. NewPass2026!). Confirm it. Click Save or Update Password.","Success message appears. You are redirected to the login page or automatically logged in."],
    ["If redirected to login, enter the email and the new password. Click Sign In.","Login succeeds. You arrive at the normal org dashboard. The old password no longer works."]]],
  [1079,"TC-079 Expired session redirects to login once — no infinite loop","Authentication","High","Alice",false,
   "A user is logged in to the EET admin dashboard. You will simulate session expiry by clearing auth cookies in browser DevTools (F12, Application tab, Cookies, delete all cookies for the EET/Fastbreak domain).",
   "User is redirected to the login page exactly once. After logging in again, user returns to the dashboard. No infinite redirect loop. No manual cookie clear required.",
   [["Log in to the EET admin dashboard normally. Navigate to any page (e.g. Events list).","Logged in. Events list is visible."],
    ["Open browser DevTools (F12). Go to Application, Storage, Cookies. Delete all cookies for the EET and Fastbreak domain. Close DevTools.","Cookies are cleared. The auth session is now invalid."],
    ["Try to perform any action on the current page, such as clicking an event or pressing the browser refresh button.","Browser detects the session is invalid."],
    ["Observe the redirect behavior carefully.","You are redirected to the login page at identity.fastbreak.ai exactly once. You are NOT bounced between pages in a loop."],
    ["Log in with valid credentials.","Login succeeds. You arrive at the EET dashboard. No error page and no need to manually clear cookies."]],
   [["Jira","https://jira.company.com/browse/TIX-1066"]]],
  [1080,"TC-080 Marketing SMS opt-in is captured correctly at checkout","Checkout and Payments","High","Alice",false,
   "Public event checkout URL available. Checkout form has a marketing SMS opt-in checkbox (e.g. Receive event updates via SMS). A phone number field is present. Test card: 4242 4242 4242 4242.",
   "When the opt-in checkbox is checked the attendee record stores TRUE. When unchecked it stores FALSE. Both orders show different opt-in values confirming correct capture.",
   [["Open the public checkout URL in a new incognito tab. Add a ticket and proceed to the checkout form.","Checkout form loads. A marketing SMS opt-in checkbox is visible."],
    ["Enter a valid phone number. Check the marketing opt-in checkbox. Complete the purchase with the test card.","Purchase succeeds. Confirmation page shown."],
    ["In the admin dashboard go to Attendees. Find this order and open Attendee Detail. Look for the marketing opt-in field.","The opt-in field shows TRUE (or Yes or Checked). It is NOT showing FALSE."],
    ["Open a second incognito tab. Do another purchase. This time leave the marketing opt-in checkbox unchecked. Complete the purchase.","Purchase succeeds."],
    ["Find the second order in Attendees and open its Attendee Detail. Check the marketing opt-in field.","The opt-in field shows FALSE (or No or Unchecked). The two orders have different opt-in values, confirming the checkbox state is captured correctly."]],
   [["Jira","https://jira.company.com/browse/TIX-534"]]],
  [1081,"TC-081 Flex Day Pass access enforced — entry rejected on unselected days","Ticket Management","High","Alice",false,
   "An event has 3 days. A Flex Day Pass ticket type exists allowing the buyer to choose any 2 of the 3 days. A buyer has purchased the pass selecting Day 1 and Day 2 only (NOT Day 3). Snap Entry is available and configured to show which day is active.",
   "QR scans successfully on Day 1 and Day 2. On Day 3 the scan is rejected with a clear message. No check-in is recorded for Day 3.",
   [["Open the public checkout for the Flex Day Pass event. Select the pass and choose Day 1 and Day 2. Do NOT select Day 3. Complete the purchase with a test card.","Purchase succeeds. Confirmation email received. Ticket shows access for Day 1 and Day 2 only."],
    ["In Snap Entry navigate to the event. Set the active scan day to Day 1. Scan the QR code.","Green success screen appears. Check-in for Day 1 is recorded."],
    ["In Snap Entry switch the active day to Day 2. Scan the same QR code.","Green success screen appears. Check-in for Day 2 is recorded."],
    ["In Snap Entry switch the active day to Day 3. Scan the same QR code.","Red rejection screen appears. Message indicates this ticket is not valid for Day 3. No check-in is recorded for Day 3."],
    ["On the admin dashboard Attendees page check the check-in records for this attendee.","Two check-in records exist (Day 1 and Day 2). No Day 3 check-in entry exists."]]],
];

const REGRESSION_CASES = RAW_CASES.map(([id,title,suite,priority,assignee,markAsCritical,preconditions,expectedResult,rawSteps,rawLinks=[]]) => ({
  id, title, suite, priority, assignee, markAsCritical, status:"draft",
  preconditions, expectedResult,
  steps: rawSteps.map(([action,expected]) => ({action,expected})),
  links: rawLinks.map(([type,url]) => ({type,url})),
}));

const TEAMS_DEFAULT = {
  Ticketing:{ color:"#3b82f6", suites:["Event Management","Ticket Management","Checkout and Payments","Snap Entry","Season Passes","Accounting and Reporting","Authentication"], cases:[] },
  Travel:{ color:"#22c55e", suites:["Search","Booking","Payments","Cancellation"], cases:[] },
  Compete:{ color:"#a855f7", suites:["Onboarding","Leaderboard","Scoring","Reporting"], cases:[] },
};

const STORAGE_KEY  = "qa-hub-shared-data";
const RUNS_KEY     = "qa-hub-runs";
const VERSION_KEY  = "qa-hub-data-version";
const DATA_VERSION = "3";

function normalizeCase(c){
  if(!c||typeof c!=="object")return c;
  return {
    ...c,
    steps:Array.isArray(c.steps)?c.steps:[],
    links:Array.isArray(c.links)?c.links:[],
    stepStatuses:Array.isArray(c.stepStatuses)?c.stepStatuses:[],
  };
}
function normalizeTeam(t){
  if(!t||typeof t!=="object")return {color:"#6b7280",suites:[],cases:[]};
  return {
    ...t,
    color:typeof t.color==="string"?t.color:"#6b7280",
    suites:Array.isArray(t.suites)?t.suites:[],
    cases:Array.isArray(t.cases)?t.cases.map(normalizeCase):[],
  };
}
function normalizeTeams(data){
  if(!data||typeof data!=="object")return JSON.parse(JSON.stringify(TEAMS_DEFAULT));
  const out={};
  for(const k of Object.keys(data))out[k]=normalizeTeam(data[k]);
  return out;
}
function normalizeRuns(raw){
  if(!raw||typeof raw!=="object")return {};
  const out={};
  for(const k of Object.keys(raw)){
    const arr=raw[k];
    if(!Array.isArray(arr)){out[k]=[];continue;}
    out[k]=arr.map(r=>{
      if(!r||typeof r!=="object")return r;
      return {...r,caseIds:Array.isArray(r.caseIds)?r.caseIds:[],results:r.results&&typeof r.results==="object"?r.results:{}};
    });
  }
  return out;
}

const PRIORITIES  = ["Low","Medium","High","Critical"];
const ASSIGNEES   = ["Bob","Alice","Charlie","Dana"];
const LINK_TYPES  = ["Jira","Docs","GitHub","Other"];
const NAV         = ["Home","Test cases","Test runs","Critical issues","Automation"];
const NAV_ICONS   = ["⌂","📋","▶️","🚨","⚙"];

// ── HASH ROUTING ──────────────────────────────────────────────────────────────
const _ns={'Home':'home','Test cases':'cases','Test runs':'runs','Critical issues':'critical','Automation':'automation'};
const _sn=Object.fromEntries(Object.entries(_ns).map(([k,v])=>[v,k]));
const _sl=s=>s.toLowerCase().replace(/[\s/]+/g,'-');
function buildHash(team,nav,suite){if(nav==='Home')return '#home';const t=_sl(team);if(suite)return `#${t}/suite/${encodeURIComponent(suite)}`;return `#${t}/${_ns[nav]||'cases'}`;}
function readHash(h){const s=(h||'').replace(/^#/,'');if(!s||s==='home')return{team:'Ticketing',nav:'Home',suite:null};const[ts,ns,...r]=s.split('/');const team=Object.keys(TEAMS_DEFAULT).find(k=>_sl(k)===ts)||'Ticketing';if(ns==='suite')return{team,nav:'Test cases',suite:decodeURIComponent(r.join('/'))};return{team,nav:_sn[ns]||'Test cases',suite:null};}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const pc  = p => ({Low:"#6b7280",Medium:"#f59e0b",High:"#f97316",Critical:"#ef4444"}[p]||"#6b7280");
const sb  = s => ({draft:{bg:"#374151",text:"#9ca3af",label:"Draft"},active:{bg:"#1e3a5f",text:"#60a5fa",label:"Active"},passed:{bg:"#14532d",text:"#4ade80",label:"Passed"},failed:{bg:"#450a0a",text:"#f87171",label:"Failed"}}[s]||{bg:"#374151",text:"#9ca3af",label:s});
const sst = s => ({untested:{bg:"#374151",text:"#9ca3af",label:"Untested",icon:"○"},passed:{bg:"#14532d",text:"#4ade80",label:"Passed",icon:"✓"},failed:{bg:"#450a0a",text:"#f87171",label:"Failed",icon:"✕"},blocked:{bg:"#451a03",text:"#fb923c",label:"Blocked",icon:"⊘"},skipped:{bg:"#1e1b4b",text:"#a5b4fc",label:"Skipped",icon:"→"}}[s]||{bg:"#374151",text:"#9ca3af",label:s,icon:"○"});

// ── CSV: QA Hub round-trip + Xray Test Case Importer + Zephyr Squad ───────────
const CSV_EXPORT_HINTS={
  legacy:"One row per test. Full round-trip with QA Hub Import.",
  xray:"Multi-row manual tests: same Test Case Identifier = one test. Map columns in Xray’s Test Case Importer (Summary, Action, Expected Result, etc.). Component = Team / Suite.",
  zephyr:"Multi-row steps: repeat Name per step (Zephyr Squad CSV). Map columns in the import wizard. Folder = Team/Suite. Labels include QA-Hub and optional Assignee:name.",
};
function escCsvCell(v){
  const s=String(v??"");
  if(/[",\n\r]/.test(s))return '"'+s.replace(/"/g,'""')+'"';
  return s;
}
function matrixToCsv(matrix){
  return matrix.map(row=>row.map(escCsvCell).join(",")).join("\n");
}
function buildLegacyExportMatrix(teams){
  const h=["Team","Suite","Title","Priority","Assignee","Status","Critical","Preconditions","Expected Result","Steps","Links"];
  const rows=Object.entries(teams).flatMap(([tn,t])=>(t.cases||[]).map(c=>[
    tn,c.suite||"",c.title||"",c.priority||"Medium",c.assignee||"",
    c.status||"draft",c.markAsCritical?"Yes":"No",
    c.preconditions||"",c.expectedResult||"",
    (c.steps||[]).map(s=>(s.action||"")+" | "+(s.expected||"")).join(" ;; "),
    (c.links||[]).map(l=>(l.type||"")+": "+(l.url||"")).join(" ;; "),
  ]));
  return [h,...rows];
}
function buildXrayExportMatrix(teams){
  const h=["Test Case Identifier","Summary","Priority","Component","Description","Action","Data","Expected Result"];
  const rows=[];
  Object.entries(teams).forEach(([tn,t])=>{
    (t.cases||[]).forEach(c=>{
      const tcid=`TC-${c.id}`;
      const comp=`${tn} / ${c.suite||""}`.trim();
      const desc=[c.preconditions||"",c.expectedResult||""].filter(Boolean).join("\n\n");
      const steps=c.steps||[];
      if(steps.length===0){
        rows.push([tcid,c.title||"",c.priority||"Medium",comp,desc,"","",""]);
      }else{
        steps.forEach((s,si)=>{
          const first=si===0;
          rows.push([
            tcid,
            first?(c.title||""):"",
            first?(c.priority||"Medium"):"",
            first?comp:"",
            first?desc:"",
            s.action||"",
            "",
            s.expected||"",
          ]);
        });
      }
    });
  });
  return [h,...rows];
}
function buildZephyrExportMatrix(teams){
  const h=["Name","Precondition","Objective","Folder","Status","Priority","Labels","Test Script (Steps) - Step","Test Script (Steps) - Expected Result"];
  const rows=[];
  Object.entries(teams).forEach(([tn,t])=>{
    (t.cases||[]).forEach(c=>{
      const folder=`${tn}/${c.suite||"General"}`.replace(/\/+/g,"/");
      const labels=["QA-Hub",c.markAsCritical?"Critical":"",c.assignee?`Assignee:${c.assignee}`:""].filter(Boolean).join(";");
      const steps=c.steps||[];
      if(steps.length===0){
        rows.push([c.title||"",c.preconditions||"",c.expectedResult||"",folder,c.status||"draft",c.priority||"Medium",labels,"",""]);
      }else{
        steps.forEach((s,si)=>{
          rows.push([
            c.title||"",
            si===0?(c.preconditions||""):"",
            si===0?(c.expectedResult||""):"",
            si===0?folder:"",
            si===0?(c.status||"draft"):"",
            si===0?(c.priority||"Medium"):"",
            si===0?labels:"",
            s.action||"",
            s.expected||"",
          ]);
        });
      }
    });
  });
  return [h,...rows];
}
function parseCsvToMatrix(text){
  const rows=[];
  let row=[];
  let field="";
  let i=0;
  let inQ=false;
  const pushF=()=>{row.push(field);field="";};
  const pushR=()=>{if(row.length>1||row[0]!=="")rows.push(row);row=[];};
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c==='"'){
        if(text[i+1]==='"'){field+='"';i+=2;continue;}
        inQ=false;i++;continue;
      }
      field+=c;i++;continue;
    }
    if(c==='"'){inQ=true;i++;continue;}
    if(c===","){pushF();i++;continue;}
    if(c==="\n"){pushF();pushR();i++;continue;}
    if(c==="\r"){i++;continue;}
    field+=c;i++;
  }
  pushF();
  if(row.length&&(row.length>1||row[0]!==""))rows.push(row);
  return rows;
}
function csvHeaderIndex(header,...cands){
  const hl=header.map(x=>String(x).trim().toLowerCase());
  for(const c of cands){
    const cl=String(c).toLowerCase();
    const ix=hl.indexOf(cl);
    if(ix>=0)return ix;
  }
  for(const c of cands){
    const cl=String(c).toLowerCase();
    const ix=hl.findIndex(h=>h.includes(cl));
    if(ix>=0)return ix;
  }
  return -1;
}
function detectCsvFormat(headerRow){
  if(!headerRow?.length)return null;
  const hl=headerRow.map(x=>String(x).trim().toLowerCase());
  if(hl.some(h=>h.includes("test case identifier"))&&hl.some(h=>h.includes("summary")))return "xray";
  if(hl.some(h=>h.includes("test script (steps)")))return "zephyr";
  if(hl.includes("team")&&hl.includes("title"))return "legacy";
  return null;
}
function parseLegacyStepsCell(cell){
  if(!cell||!String(cell).trim())return[];
  return String(cell).split(/\s*;;\s*/).map(part=>{
    const j=part.indexOf(" | ");
    if(j<0)return{action:part.trim(),expected:""};
    return{action:part.slice(0,j).trim(),expected:part.slice(j+3).trim()};
  });
}
function parseLegacyLinksCell(cell){
  if(!cell||!String(cell).trim())return[];
  return String(cell).split(/\s*;;\s*/).map(part=>{
    const j=part.indexOf(": ");
    if(j<0)return{type:"Other",url:part.trim()};
    return{type:part.slice(0,j).trim()||"Other",url:part.slice(j+2).trim()};
  }).filter(l=>l.url);
}
function normStatus(s){
  const x=String(s||"").trim().toLowerCase();
  if(["draft","active","passed","failed"].includes(x))return x;
  if(x==="pass"||x==="passed")return "passed";
  if(x==="fail"||x==="failed")return "failed";
  return "draft";
}
function newCaseId(){return Math.floor(Date.now()+Math.random()*1e9);}
function importCasesFromMatrix(matrix,fmt){
  if(matrix.length<2)return{ok:false,error:"No data rows"};
  const h=matrix[0].map(x=>String(x).trim());
  const merge={};
  const add=(team,c)=>{
    if(!merge[team])merge[team]=[];
    merge[team].push(c);
  };
  if(fmt==="legacy"){
    const iT=csvHeaderIndex(h,"team"),iS=csvHeaderIndex(h,"suite"),iTi=csvHeaderIndex(h,"title"),iP=csvHeaderIndex(h,"priority"),
      iA=csvHeaderIndex(h,"assignee"),iSt=csvHeaderIndex(h,"status"),iCr=csvHeaderIndex(h,"critical"),
      iPr=csvHeaderIndex(h,"preconditions"),iEx=csvHeaderIndex(h,"expected result"),iSteps=csvHeaderIndex(h,"steps"),iLk=csvHeaderIndex(h,"links");
    if(iT<0||iTi<0)return{ok:false,error:"Legacy CSV needs Team and Title columns"};
    for(let r=1;r<matrix.length;r++){
      const row=matrix[r];
      const title=String(row[iTi]??"").trim();
      if(!title)continue;
      const team=String(row[iT]??"").trim()||"Imported";
      const crit=String(row[iCr]??"").trim().toLowerCase();
      add(team,{
        id:newCaseId(),
        title,
        suite:String(row[iS]??"").trim()||"General",
        priority:PRIORITIES.includes(row[iP])?row[iP]:"Medium",
        assignee:ASSIGNEES.includes(row[iA])?row[iA]:"Bob",
        status:normStatus(row[iSt]),
        markAsCritical:["yes","y","true","1","critical"].includes(crit),
        preconditions:String(row[iPr]??"").trim(),
        expectedResult:String(row[iEx]??"").trim(),
        steps:parseLegacyStepsCell(row[iSteps]),
        links:parseLegacyLinksCell(row[iLk]),
      });
    }
  }else if(fmt==="xray"){
    const iId=csvHeaderIndex(h,"test case identifier","tcid"),iSu=csvHeaderIndex(h,"summary"),iPr=csvHeaderIndex(h,"priority"),
      iCo=csvHeaderIndex(h,"component"),iDe=csvHeaderIndex(h,"description"),iAc=csvHeaderIndex(h,"action"),
      iEx=csvHeaderIndex(h,"expected result","result");
    if(iId<0)return{ok:false,error:"Xray CSV needs Test Case Identifier"};
    const groups=new Map();
    for(let r=1;r<matrix.length;r++){
      const row=matrix[r];
      const id=String(row[iId]??"").trim();
      if(!id)continue;
      if(!groups.has(id))groups.set(id,{title:"",priority:"Medium",component:"",description:"",steps:[]});
      const g=groups.get(id);
      const su=String(row[iSu]??"").trim();
      if(su)g.title=su;
      const pr=String(row[iPr]??"").trim();
      if(pr)g.priority=pr;
      const co=String(row[iCo]??"").trim();
      if(co)g.component=co;
      const de=String(row[iDe]??"").trim();
      if(de)g.description=de;
      const ac=String(row[iAc]??"").trim();
      const ex=String(row[iEx]??"").trim();
      if(ac||ex)g.steps.push({action:ac,expected:ex});
    }
    for(const [,g] of groups){
      if(!g.title)continue;
      const comp=g.component||"Imported / General";
      const parts=comp.split(/\s*\/\s*/);
      const team=parts[0]?.trim()||"Imported";
      const suite=parts.slice(1).join(" / ").trim()||"General";
      const desc=g.description||"";
      const dp=desc.split(/\n\n+/);
      add(team,{
        id:newCaseId(),
        title:g.title,
        suite,
        priority:PRIORITIES.includes(g.priority)?g.priority:"Medium",
        assignee:"Bob",
        status:"draft",
        markAsCritical:false,
        preconditions:(dp[0]||"").trim(),
        expectedResult:dp.slice(1).join("\n\n").trim(),
        steps:g.steps.length?g.steps:[],
        links:[],
      });
    }
  }else if(fmt==="zephyr"){
    const iN=csvHeaderIndex(h,"name"),iPr=csvHeaderIndex(h,"precondition"),iOb=csvHeaderIndex(h,"objective"),
      iFo=csvHeaderIndex(h,"folder"),iSt=csvHeaderIndex(h,"status"),iPi=csvHeaderIndex(h,"priority"),iLb=csvHeaderIndex(h,"labels"),
      iStp=csvHeaderIndex(h,"test script (steps) - step"),iExp=csvHeaderIndex(h,"test script (steps) - expected result");
    if(iN<0)return{ok:false,error:"Zephyr CSV needs Name column"};
    let cur=null;
    const flush=()=>{
      if(!cur||!cur.title)return;
      const folder=cur.folder||"Imported/General";
      const fp=folder.split("/");
      const team=fp[0]?.trim()||"Imported";
      const suite=fp.slice(1).join("/").trim()||"General";
      let assignee="Bob";
      const lb=cur.labels||"";
      const m=lb.match(/assignee:\s*([^;]+)/i);
      if(m){const name=m[1].trim();if(ASSIGNEES.includes(name))assignee=name;}
      const crit=/\bcritical\b/i.test(lb);
      add(team,{
        id:newCaseId(),
        title:cur.title,
        suite,
        priority:PRIORITIES.includes(cur.priority)?cur.priority:"Medium",
        assignee,
        status:normStatus(cur.status),
        markAsCritical:crit,
        preconditions:cur.preconditions||"",
        expectedResult:cur.objective||"",
        steps:cur.steps.length?cur.steps:[],
        links:[],
      });
    };
    for(let r=1;r<matrix.length;r++){
      const row=matrix[r];
      const name=String(row[iN]??"").trim();
      const step=String(row[iStp]??"").trim();
      const exp=String(row[iExp]??"").trim();
      if(name){
        flush();
        cur={
          title:name,
          preconditions:String(row[iPr]??"").trim(),
          objective:String(row[iOb]??"").trim(),
          folder:String(row[iFo]??"").trim(),
          status:String(row[iSt]??"").trim()||"draft",
          priority:String(row[iPi]??"").trim()||"Medium",
          labels:String(row[iLb]??"").trim(),
          steps:[],
        };
      }
      if(cur&&(step||exp))cur.steps.push({action:step,expected:exp});
    }
    flush();
  }
  const count=Object.values(merge).reduce((a,b)=>a+b.length,0);
  if(count===0)return{ok:false,error:"No test cases found in file"};
  return{ok:true,count,merge};
}
function applyCsvImportMerge(prevTeams,merge){
  const next={...prevTeams};
  const def=JSON.parse(JSON.stringify(TEAMS_DEFAULT));
  for(const [tn,newCases] of Object.entries(merge)){
    const base=next[tn]||def[tn]||{color:"#6b7280",suites:[],cases:[]};
    const suiteSet=new Set(base.suites||[]);
    newCases.forEach(c=>{if(c.suite)suiteSet.add(c.suite);});
    next[tn]=normalizeTeam({
      ...base,
      color:base.color||"#6b7280",
      suites:[...suiteSet],
      cases:[...(base.cases||[]),...newCases.map(normalizeCase)],
    });
  }
  return next;
}

function Toast({msg,type}){
  const bg={error:"#450a0a",info:"#1e3a5f",success:"#14532d"}[type]||"#14532d";
  const cl={error:"#f87171",info:"#60a5fa",success:"#4ade80"}[type]||"#4ade80";
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:200,background:bg,border:`1px solid ${cl}`,color:cl,borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}><span>{type==="error"?"⚠":type==="info"?"↻":"✓"}</span>{msg}</div>;
}
function Overlay({onClose,width=680,children}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}><div style={{background:"#1f2937",borderRadius:12,width,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>{children}</div></div>;
}
function Sel({value,onChange,options,style}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{background:"#374151",color:"#f9fafb",border:"1px solid #4b5563",borderRadius:6,padding:"8px 12px",fontSize:13,cursor:"pointer",...style}}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>;
}

// ── CSV EXPORT MODAL ───────────────────────────────────────────────────────────
function CsvModal({teams,onClose,showToast}){
  const [fmt,setFmt]=useState("legacy");
  const csv=useMemo(()=>{
    if(fmt==="legacy")return matrixToCsv(buildLegacyExportMatrix(teams));
    if(fmt==="xray")return matrixToCsv(buildXrayExportMatrix(teams));
    return matrixToCsv(buildZephyrExportMatrix(teams));
  },[fmt,teams]);
  const copy=async()=>{
    try{
      await navigator.clipboard.writeText(csv);
      showToast("Copied to clipboard!");
    }catch{
      const ta=document.getElementById("qa-csv-ta");
      if(ta){ta.select();document.execCommand("copy");showToast("Copied to clipboard!");}
    }
    onClose();
  };
  const tab=(id,label)=>(
    <button type="button" key={id} onClick={()=>setFmt(id)} style={{background:fmt===id?"#374151":"transparent",border:`1px solid ${fmt===id?"#60a5fa":"#4b5563"}`,color:fmt===id?"#f9fafb":"#9ca3af",borderRadius:6,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{label}</button>
  );
  return (
    <Overlay onClose={onClose} width={780}>
      <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #374151"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#f9fafb"}}>Export CSV</div>
            <div style={{fontSize:12,color:"#9ca3af",marginTop:4,lineHeight:1.45,maxWidth:640}}>{CSV_EXPORT_HINTS[fmt]}</div>
          </div>
          <button type="button" onClick={onClose} style={{background:"none",border:"1px solid #4b5563",color:"#6b7280",borderRadius:7,padding:"6px 12px",fontSize:14,cursor:"pointer"}}>x</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:14}}>
          {tab("legacy","QA Hub (round-trip)")}
          {tab("xray","Xray Test Importer")}
          {tab("zephyr","Zephyr Squad")}
        </div>
      </div>
      <div style={{padding:"16px 24px 24px"}}>
        <div style={{background:"#111827",border:"1px solid #374151",borderRadius:8,marginBottom:12}}>
          <textarea id="qa-csv-ta" readOnly value={csv} onClick={e=>e.target.select()} style={{width:"100%",height:300,background:"transparent",border:"none",color:"#9ca3af",fontSize:11,fontFamily:"monospace",resize:"vertical",outline:"none",padding:14,boxSizing:"border-box",lineHeight:1.5}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#6b7280"}}>Save as UTF-8 .csv, then import in Jira (map columns in Xray/Zephyr wizards).</span>
          <button type="button" onClick={copy} style={{background:"#3b82f6",border:"none",color:"#fff",borderRadius:7,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",flexShrink:0}}>Copy to clipboard</button>
        </div>
      </div>
    </Overlay>
  );
}

// ── CASE DETAIL PANEL ─────────────────────────────────────────────────────────
function CaseDetail({c,onClose,onEdit,onStepStatusChange}){
  const [stepSts,setStepSts]=useState(()=>(c.steps||[]).map((_,i)=>(c.stepStatuses||[])[i]||"untested"));
  const cycle={untested:"passed",passed:"failed",failed:"blocked",blocked:"skipped",skipped:"untested"};
  const cycleStep=i=>setStepSts(ss=>{const n=[...ss];n[i]=cycle[n[i]];onStepStatusChange&&onStepStatusChange(c.id,n);return n;});
  const resetSteps=()=>{const r=(c.steps||[]).map(()=>"untested");setStepSts(r);onStepStatusChange&&onStepStatusChange(c.id,r);};
  const passed=stepSts.filter(s=>s==="passed").length;
  const failed=stepSts.filter(s=>s==="failed").length;
  const total=stepSts.length;
  const pct=total>0?Math.round((passed/total)*100):0;
  const badge=sb(c.status);
  const linkClr=t=>({Jira:"#2684ff",Docs:"#22c55e",GitHub:"#9ca3af",Other:"#a855f7"}[t]||"#6b7280");
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#161d2b",borderLeft:"1px solid #374151"}}>
      <div style={{padding:"18px 20px 14px",borderBottom:"1px solid #374151",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,flexWrap:"wrap"}}>
              <span style={{background:badge.bg,color:badge.text,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{badge.label}</span>
              <span style={{color:pc(c.priority),fontSize:11,fontWeight:600}}>● {c.priority}</span>
              {c.markAsCritical&&<span style={{background:"rgba(239,68,68,.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,.3)",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:700}}>CRITICAL</span>}
            </div>
            <div style={{fontSize:15,fontWeight:800,color:"#f9fafb",lineHeight:1.35,marginBottom:6}}>{c.title}</div>
            <div style={{display:"flex",gap:14,fontSize:11,color:"#6b7280",flexWrap:"wrap"}}>
              <span>Suite: <strong style={{color:"#d1d5db"}}>{c.suite}</strong></span>
              <span>Assignee: <strong style={{color:"#d1d5db"}}>{c.assignee}</strong></span>
              <span>{total} steps</span>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            <button onClick={onEdit} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer"}}>Edit</button>
            <button onClick={onClose} style={{background:"none",border:"1px solid #4b5563",color:"#6b7280",borderRadius:6,padding:"5px 10px",fontSize:14,cursor:"pointer"}}>x</button>
          </div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px 24px"}}>
        {total>0&&(
          <div style={{background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"12px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <span style={{fontSize:11,fontWeight:700,color:"#9ca3af"}}>Run progress</span>
              <div style={{display:"flex",gap:10,fontSize:11,alignItems:"center"}}>
                <span style={{color:"#4ade80"}}>✓ {passed} passed</span>
                <span style={{color:"#f87171"}}>✕ {failed} failed</span>
                <span style={{color:"#9ca3af"}}>○ {total-passed-failed} remaining</span>
                <button onClick={resetSteps} style={{background:"#374151",border:"1px solid #4b5563",color:"#9ca3af",borderRadius:4,padding:"1px 7px",fontSize:10,cursor:"pointer"}}>Reset</button>
              </div>
            </div>
            <div style={{height:5,background:"#374151",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,background:failed>0?"#ef4444":"#4ade80",borderRadius:3,transition:"width .3s"}}/>
            </div>
          </div>
        )}
        {c.preconditions&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:".07em",textTransform:"uppercase",marginBottom:6}}>Preconditions</div>
            <div style={{background:"#111827",border:"1px solid #374151",borderRadius:7,padding:"10px 14px",fontSize:12,color:"#d1d5db",lineHeight:1.6}}>{c.preconditions}</div>
          </div>
        )}
        {total>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:".07em",textTransform:"uppercase",marginBottom:8}}>Test Steps</div>
            <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 100px",background:"#111827",borderRadius:"7px 7px 0 0",border:"1px solid #374151",borderBottom:"none"}}>
              {["#","Action","Expected","Status"].map((h,i)=>(
                <div key={h} style={{padding:"6px 10px",fontSize:10,fontWeight:700,color:"#6b7280",borderLeft:i>0?"1px solid #374151":"none",textAlign:i===0||i===3?"center":"left"}}>{h}</div>
              ))}
            </div>
            {(c.steps||[]).map((step,i)=>{
              const stepsArr=c.steps||[];
              const ss=sst(stepSts[i]);
              return (
                <div key={i} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 100px",background:stepSts[i]==="untested"?"#1a2332":ss.bg+"33",border:"1px solid #374151",borderTop:"none",borderRadius:i===stepsArr.length-1?"0 0 7px 7px":0}}>
                  <div style={{padding:"11px 8px",display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
                    <span style={{width:18,height:18,borderRadius:"50%",background:"#374151",border:"1px solid #4b5563",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#9ca3af",fontWeight:700}}>{i+1}</span>
                  </div>
                  <div style={{padding:"11px 10px",borderLeft:"1px solid #374151",fontSize:12,color:"#e5e7eb",lineHeight:1.5}}>{step.action}</div>
                  <div style={{padding:"11px 10px",borderLeft:"1px solid #374151",fontSize:12,color:"#9ca3af",lineHeight:1.5}}>{step.expected}</div>
                  <div style={{padding:"8px 6px",borderLeft:"1px solid #374151",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <button onClick={()=>cycleStep(i)} style={{background:ss.bg,color:ss.text,border:`1px solid ${ss.text}44`,borderRadius:5,padding:"4px 0",fontSize:10,fontWeight:700,cursor:"pointer",width:86,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
                      <span>{ss.icon}</span>{ss.label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {c.expectedResult&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:".07em",textTransform:"uppercase",marginBottom:6}}>Overall Expected Result</div>
            <div style={{background:"#111827",border:"1px solid #374151",borderRadius:7,padding:"10px 14px",fontSize:12,color:"#d1d5db",lineHeight:1.6}}>{c.expectedResult}</div>
          </div>
        )}
        {c.links&&c.links.length>0&&(
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:".07em",textTransform:"uppercase",marginBottom:6}}>Links</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {c.links.map((link,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #374151",borderRadius:6,padding:"8px 12px"}}>
                  <span style={{fontSize:10,fontWeight:700,background:linkClr(link.type)+"22",color:linkClr(link.type),border:`1px solid ${linkClr(link.type)}44`,borderRadius:4,padding:"2px 6px",flexShrink:0}}>{link.type}</span>
                  <a href={link.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#60a5fa",textDecoration:"none",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{link.url}</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RUN VIEW ──────────────────────────────────────────────────────────────────
function RunView({run,cases,onUpdate,onClose}){
  const caseIds=run.caseIds||[];
  const ac=cases.filter(c=>caseIds.includes(c.id));
  const res=run.results||{};
  const setStepRes=(cid,si,val)=>{const r={...res};if(!r[cid])r[cid]={};r[cid][si]=val;onUpdate({...run,results:r});};
  const setCaseNote=(cid,v)=>{const r={...res};if(!r[cid])r[cid]={};r[cid]._note=v;onUpdate({...run,results:r});};
  const setCaseSt=(cid,v)=>{const r={...res};if(!r[cid])r[cid]={};r[cid]._status=v;onUpdate({...run,results:r});};
  const [exp,setExp]=useState({});
  const tog=id=>setExp(e=>({...e,[id]:!e[id]}));
  const sts=ac.map(c=>res[c.id]?._status||"untested");
  const passed=sts.filter(s=>s==="passed").length,failed=sts.filter(s=>s==="failed").length,blocked=sts.filter(s=>s==="blocked").length,untested=sts.filter(s=>s==="untested").length;
  const pct=ac.length>0?Math.round((passed/ac.length)*100):0;
  const inp={background:"#374151",border:"1px solid #4b5563",borderRadius:6,color:"#f9fafb",padding:"6px 10px",fontSize:12,width:"100%",boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #374151",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexShrink:0}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:"#6b7280",fontWeight:600,marginBottom:4}}>TEST RUN</div>
          <div style={{fontSize:20,fontWeight:800,color:"#f9fafb",marginBottom:6}}>{run.name}</div>
          <div style={{display:"flex",gap:16,fontSize:12,color:"#6b7280",flexWrap:"wrap"}}>
            <span>Started: <strong style={{color:"#d1d5db"}}>{new Date(run.createdAt).toLocaleString()}</strong></span>
            <span>By: <strong style={{color:"#d1d5db"}}>{run.createdBy}</strong></span>
            <span>{ac.length} cases</span>
          </div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"1px solid #4b5563",color:"#6b7280",borderRadius:7,padding:"7px 12px",fontSize:14,cursor:"pointer"}}>x</button>
      </div>
      <div style={{padding:"14px 24px",borderBottom:"1px solid #374151",background:"#111827",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"#f9fafb"}}>{pct}% Complete</span>
          <div style={{display:"flex",gap:16,fontSize:12}}>
            <span style={{color:"#4ade80"}}>✓ {passed}</span>
            <span style={{color:"#f87171"}}>✕ {failed}</span>
            <span style={{color:"#fb923c"}}>⊘ {blocked}</span>
            <span style={{color:"#9ca3af"}}>○ {untested}</span>
          </div>
        </div>
        <div style={{height:8,background:"#374151",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:failed>0?"#ef4444":"#4ade80",transition:"width .3s",borderRadius:4}}/>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
        {ac.map(c=>{
          const cr=res[c.id]||{},cst=cr._status||"untested",open=exp[c.id];
          return (
            <div key={c.id} style={{background:"#1f2937",border:`1px solid ${cst==="failed"?"#f8717155":cst==="passed"?"#4ade8055":"#374151"}`,borderRadius:10,marginBottom:8,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>tog(c.id)}>
                <span style={{fontSize:13,color:"#6b7280",flexShrink:0,width:20,textAlign:"center"}}>{open?"▾":"▸"}</span>
                <span style={{flex:1,fontSize:13,fontWeight:600,color:"#f9fafb"}}>{c.title}</span>
                <span style={{fontSize:11,color:pc(c.priority),flexShrink:0}}>● {c.priority}</span>
                <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                  {["passed","failed","blocked","skipped","untested"].map(st=>{const s2=sst(st),act=cst===st;return <button key={st} onClick={()=>setCaseSt(c.id,st)} style={{background:act?s2.bg:"#374151",color:act?s2.text:"#6b7280",border:`1px solid ${act?s2.text+"66":"#4b5563"}`,borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{s2.icon}</button>;})}
                </div>
              </div>
              {open&&(
                <div style={{borderTop:"1px solid #374151",padding:"12px 16px",background:"#111827"}}>
                  {(c.steps||[]).length>0&&(
                    <div style={{marginBottom:12}}>
                      <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 96px",background:"#1f2937",borderRadius:"6px 6px 0 0",border:"1px solid #374151",borderBottom:"none"}}>
                        {["#","Action","Expected","Result"].map((h,i)=><div key={h} style={{padding:"6px 10px",fontSize:10,fontWeight:700,color:"#6b7280",borderLeft:i>0?"1px solid #374151":"none",textAlign:i===0||i===3?"center":"left"}}>{h}</div>)}
                      </div>
                      {(c.steps||[]).map((step,si)=>{
                        const runSteps=c.steps||[];
                        const sv=cr[si]||"untested",ss2=sst(sv),cyc2={untested:"passed",passed:"failed",failed:"blocked",blocked:"skipped",skipped:"untested"};
                        return (
                          <div key={si} style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 96px",background:sv==="untested"?"#1a2332":ss2.bg+"22",border:"1px solid #374151",borderTop:"none",borderRadius:si===runSteps.length-1?"0 0 6px 6px":0}}>
                            <div style={{padding:"10px 6px",display:"flex",alignItems:"flex-start",justifyContent:"center"}}><span style={{width:16,height:16,borderRadius:"50%",background:"#374151",border:"1px solid #4b5563",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#9ca3af",fontWeight:700}}>{si+1}</span></div>
                            <div style={{padding:"10px",borderLeft:"1px solid #374151",fontSize:12,color:"#e5e7eb",lineHeight:1.5}}>{step.action}</div>
                            <div style={{padding:"10px",borderLeft:"1px solid #374151",fontSize:12,color:"#9ca3af",lineHeight:1.5}}>{step.expected}</div>
                            <div style={{padding:"8px 6px",borderLeft:"1px solid #374151",display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <button onClick={()=>setStepRes(c.id,si,cyc2[sv])} style={{background:ss2.bg,color:ss2.text,border:`1px solid ${ss2.text}44`,borderRadius:5,padding:"4px 0",fontSize:10,fontWeight:700,cursor:"pointer",width:80,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}><span>{ss2.icon}</span>{ss2.label}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <div style={{fontSize:11,color:"#6b7280",marginBottom:4,fontWeight:600}}>Notes / Bug reference</div>
                    <input value={cr._note||""} onChange={e=>setCaseNote(c.id,e.target.value)} placeholder="Add a note, bug ID, or comment" style={inp}/>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── NEW RUN FORM ──────────────────────────────────────────────────────────────
function NewRunForm({cases,teamName,teamColor,onSave,onCancel}){
  const [name,setName]=useState("Run " + new Date().toLocaleDateString());
  const [by,setBy]=useState("Bob");
  const [sel,setSel]=useState(new Set(cases.map(c=>c.id)));
  const [filt,setFilt]=useState("All");
  const suites=[...new Set(cases.map(c=>c.suite))];
  const filt2=filt==="All"?cases:cases.filter(c=>c.suite===filt);
  const tog=id=>setSel(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const togAll=()=>setSel(s=>s.size===filt2.length?new Set():new Set(filt2.map(c=>c.id)));
  const inp={background:"#374151",border:"1px solid #4b5563",borderRadius:6,color:"#f9fafb",padding:"8px 12px",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  return (
    <>
      <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #374151"}}>
        <div style={{fontSize:11,color:"#9ca3af",marginBottom:2}}>{teamName} New Test Run</div>
        <div style={{fontSize:18,fontWeight:700,color:"#f9fafb"}}>Create Test Run</div>
      </div>
      <div style={{padding:"20px 24px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div><label style={{fontSize:12,color:"#d1d5db",marginBottom:6,display:"block"}}>Run name</label><input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sprint 12 Regression"/></div>
          <div><label style={{fontSize:12,color:"#d1d5db",marginBottom:6,display:"block"}}>Run by</label><Sel value={by} onChange={setBy} options={ASSIGNEES} style={{width:"100%"}}/></div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <label style={{fontSize:12,color:"#d1d5db",fontWeight:600}}>Select cases ({sel.size} selected)</label>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Sel value={filt} onChange={setFilt} options={["All",...suites]} style={{fontSize:12,padding:"4px 8px"}}/>
              <button onClick={togAll} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:5,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>{sel.size===filt2.length?"Deselect all":"Select all"}</button>
            </div>
          </div>
          <div style={{maxHeight:300,overflowY:"auto",border:"1px solid #374151",borderRadius:8}}>
            {filt2.map((c,i)=>(
              <div key={c.id} onClick={()=>tog(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:sel.has(c.id)?"#1e3a5f22":"transparent",borderBottom:i<filt2.length-1?"1px solid #374151":"none"}}
                onMouseEnter={e=>e.currentTarget.style.background=sel.has(c.id)?"#1e3a5f44":"#37415144"}
                onMouseLeave={e=>e.currentTarget.style.background=sel.has(c.id)?"#1e3a5f22":"transparent"}>
                <div style={{width:16,height:16,borderRadius:4,background:sel.has(c.id)?"#3b82f6":"#374151",border:`1px solid ${sel.has(c.id)?"#3b82f6":"#4b5563"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {sel.has(c.id)&&<span style={{fontSize:10,color:"#fff",fontWeight:700}}>✓</span>}
                </div>
                <span style={{flex:1,fontSize:12,color:"#f9fafb"}}>{c.title}</span>
                <span style={{fontSize:11,color:pc(c.priority)}}>● {c.priority}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onCancel} style={{background:"none",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:7,padding:"9px 20px",fontSize:13,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave({id:Date.now(),name,createdBy:by,createdAt:Date.now(),caseIds:[...sel],results:{},status:"in_progress"})} disabled={!name.trim()||sel.size===0} style={{background:teamColor,border:"none",color:"#fff",borderRadius:7,padding:"9px 20px",fontSize:13,cursor:"pointer",fontWeight:600,opacity:!name.trim()||sel.size===0?.5:1}}>
            Start Run ({sel.size} cases)
          </button>
        </div>
      </div>
    </>
  );
}

// ── RUNS LIST ─────────────────────────────────────────────────────────────────
function RunsList({runs,teamColor,onOpen,onNew,onDelete}){
  const list=Array.isArray(runs)?runs:[];
  if(!list.length) return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:48}}>▶️</div>
      <div style={{fontSize:16,fontWeight:700,color:"#6b7280"}}>No test runs yet</div>
      <button onClick={onNew} style={{background:teamColor,border:"none",color:"#fff",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Test Run</button>
    </div>
  );
  return (
    <div style={{flex:1,overflowY:"auto",padding:20}}>
      {[...list].reverse().map(run=>{
        const ids=run.caseIds||[];
        const total=ids.length,res=run.results||{};
        const sts=ids.map(id=>res[id]?._status||"untested");
        const passed=sts.filter(s=>s==="passed").length,failed=sts.filter(s=>s==="failed").length,blocked=sts.filter(s=>s==="blocked").length,untested=sts.filter(s=>s==="untested").length;
        const pct=total>0?Math.round((passed/total)*100):0;
        const hasFail=failed>0,done=untested===0;
        return (
          <div key={run.id} style={{background:"#1f2937",border:`1px solid ${hasFail?"#f8717133":done?"#4ade8033":"#374151"}`,borderRadius:12,padding:"16px 20px",marginBottom:10,cursor:"pointer"}}
            onClick={()=>onOpen(run)}
            onMouseEnter={e=>e.currentTarget.style.borderColor=hasFail?"#f87171":"#60a5fa"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=hasFail?"#f8717133":done?"#4ade8033":"#374151"}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:15,fontWeight:700,color:"#f9fafb"}}>{run.name}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:hasFail?"rgba(239,68,68,.15)":done?"rgba(74,222,128,.15)":"rgba(96,165,250,.15)",color:hasFail?"#f87171":done?"#4ade80":"#60a5fa"}}>{hasFail?"FAILED":done?"PASSED":"IN PROGRESS"}</span>
                </div>
                <div style={{fontSize:12,color:"#6b7280"}}>By <strong style={{color:"#d1d5db"}}>{run.createdBy}</strong> · {new Date(run.createdAt).toLocaleDateString()} · {total} cases</div>
              </div>
              <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete this run?"))onDelete(run.id);}} style={{background:"none",border:"1px solid #374151",color:"#6b7280",borderRadius:5,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>x</button>
            </div>
            <div style={{height:6,background:"#374151",borderRadius:3,overflow:"hidden",marginBottom:8}}>
              <div style={{height:"100%",width:`${pct}%`,background:hasFail?"#ef4444":"#4ade80",borderRadius:3}}/>
            </div>
            <div style={{display:"flex",gap:16,fontSize:12}}>
              <span style={{color:"#4ade80"}}>✓ {passed}</span>
              <span style={{color:"#f87171"}}>✕ {failed}</span>
              <span style={{color:"#fb923c"}}>⊘ {blocked}</span>
              <span style={{color:"#9ca3af"}}>○ {untested}</span>
              <span style={{color:"#6b7280",marginLeft:"auto"}}>{pct}% complete</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SUITE EDITOR ──────────────────────────────────────────────────────────────
function SuiteEditor({teamName,teamColor,suites,onSave,onClose}){
  const [list,setList]=useState([...(suites||[])]);
  const [nv,setNv]=useState(""),[ei,setEi]=useState(null),[ev,setEv]=useState("");
  const ir=useRef();
  const add=()=>{const t=nv.trim();if(!t||list.includes(t))return;setList(l=>[...l,t]);setNv("");ir.current?.focus();};
  const rem=i=>setList(l=>l.filter((_,j)=>j!==i));
  const se=i=>{setEi(i);setEv(list[i]);};
  const ce=()=>{const t=ev.trim();if(t&&!list.filter((_,j)=>j!==ei).includes(t))setList(l=>l.map((s,j)=>j===ei?t:s));setEi(null);};
  const mu=i=>{if(!i)return;const l=[...list];[l[i-1],l[i]]=[l[i],l[i-1]];setList(l);};
  const md=i=>{if(i===list.length-1)return;const l=[...list];[l[i],l[i+1]]=[l[i+1],l[i]];setList(l);};
  const inp={background:"#374151",border:"1px solid #4b5563",borderRadius:6,color:"#f9fafb",padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"inherit"};
  return (
    <div>
      <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #374151",display:"flex",alignItems:"center",gap:12}}>
        <span style={{width:32,height:32,borderRadius:8,background:teamColor+"22",border:`1.5px solid ${teamColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:teamColor}}>{teamName[0]}</span>
        <div><div style={{fontSize:11,color:"#9ca3af"}}>{teamName}</div><div style={{fontSize:17,fontWeight:700,color:"#f9fafb"}}>Edit Suites</div></div>
      </div>
      <div style={{padding:"20px 24px 24px"}}>
        <div style={{marginBottom:16}}>
          {list.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,background:"#111827",borderRadius:8,padding:"8px 12px",border:"1px solid #374151"}}>
              <div style={{display:"flex",flexDirection:"column",gap:1}}>
                <button onClick={()=>mu(i)} style={{background:"none",border:"none",color:i===0?"#374151":"#6b7280",cursor:i===0?"default":"pointer",fontSize:10,lineHeight:1,padding:0}}>▲</button>
                <button onClick={()=>md(i)} style={{background:"none",border:"none",color:i===list.length-1?"#374151":"#6b7280",cursor:i===list.length-1?"default":"pointer",fontSize:10,lineHeight:1,padding:0}}>▼</button>
              </div>
              {ei===i?<input autoFocus value={ev} onChange={e=>setEv(e.target.value)} onBlur={ce} onKeyDown={e=>{if(e.key==="Enter")ce();if(e.key==="Escape")setEi(null);}} style={{...inp,flex:1,padding:"5px 10px"}}/>
                :<span onClick={()=>se(i)} style={{flex:1,fontSize:13,color:"#f9fafb",cursor:"text"}}>{s}</span>}
              <button onClick={()=>rem(i)} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:16}}>x</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          <input ref={ir} value={nv} onChange={e=>setNv(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="New suite name" style={{...inp,flex:1}}/>
          <button onClick={add} style={{background:teamColor,border:"none",color:"#fff",borderRadius:7,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Add</button>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{background:"none",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:7,padding:"9px 20px",fontSize:13,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave(list)} style={{background:teamColor,border:"none",color:"#fff",borderRadius:7,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save suites</button>
        </div>
      </div>
    </div>
  );
}

// ── TEST CASE FORM ────────────────────────────────────────────────────────────
function TestCaseForm({initial,onSave,onCancel,suites,teamName}){
  const suiteList=Array.isArray(suites)&&suites.length?suites:[""];
  const empty={title:"",suite:suiteList[0]||"",priority:"Medium",assignee:"Bob",preconditions:"",expectedResult:"",markAsCritical:false,steps:[{action:"",expected:""}],links:[],status:"draft"};
  const [form,setForm]=useState(()=>{
    if(!initial)return empty;
    return {...empty,...initial,steps:Array.isArray(initial.steps)&&initial.steps.length?initial.steps:empty.steps,links:Array.isArray(initial.links)?initial.links:[]};
  });
  const [tab,setTab]=useState("Links");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const ss=(i,k,v)=>{const s=[...form.steps];s[i]={...s[i],[k]:v};set("steps",s);};
  const as=()=>set("steps",[...form.steps,{action:"",expected:""}]);
  const rs=i=>set("steps",form.steps.filter((_,j)=>j!==i));
  const al=()=>set("links",[...form.links,{type:"Jira",url:""}]);
  const sl=(i,k,v)=>{const l=[...form.links];l[i]={...l[i],[k]:v};set("links",l);};
  const rl=i=>set("links",form.links.filter((_,j)=>j!==i));
  const inp={background:"#374151",border:"1px solid #4b5563",borderRadius:6,color:"#f9fafb",padding:"8px 12px",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  return (
    <>
      <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #374151"}}>
        <div style={{fontSize:11,color:"#9ca3af",marginBottom:2}}>{teamName} {initial?"Edit":"New"} test case</div>
        <div style={{fontSize:18,fontWeight:700,color:"#f9fafb"}}>{initial?"Edit test case":"Add test case"}</div>
      </div>
      <div style={{padding:"20px 24px 24px"}}>
        <div style={{marginBottom:16}}><label style={{fontSize:12,color:"#d1d5db",marginBottom:6,display:"block"}}>Title</label><input style={inp} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Test case title"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
          {[["Suite","suite",suiteList],["Priority","priority",PRIORITIES],["Assignee","assignee",ASSIGNEES]].map(([label,key,opts])=>(
            <div key={key}><label style={{fontSize:12,color:"#d1d5db",marginBottom:6,display:"block"}}>{label}</label><Sel value={form[key]} onChange={v=>set(key,v)} options={opts} style={{width:"100%"}}/></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          {[["Preconditions","preconditions"],["Expected result","expectedResult"]].map(([label,key])=>(
            <div key={key}><label style={{fontSize:12,color:"#d1d5db",marginBottom:6,display:"block"}}>{label}</label><textarea style={{...inp,height:80,resize:"vertical"}} value={form[key]} onChange={e=>set(key,e.target.value)}/></div>
          ))}
        </div>
        <div style={{background:form.markAsCritical?"rgba(239,68,68,.12)":"#374151",border:`1px solid ${form.markAsCritical?"#ef4444":"#4b5563"}`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,cursor:"pointer"}} onClick={()=>set("markAsCritical",!form.markAsCritical)}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:20,borderRadius:10,background:form.markAsCritical?"#ef4444":"#6b7280",position:"relative",transition:"background .2s"}}><div style={{position:"absolute",top:2,left:form.markAsCritical?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/></div>
            <span style={{fontSize:13,color:form.markAsCritical?"#fca5a5":"#9ca3af"}}>Mark as critical</span>
          </div>
          {form.markAsCritical&&<span style={{fontSize:12,color:"#ef4444",fontWeight:600}}>Failure will block the release</span>}
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,color:"#f9fafb",marginBottom:12}}>Test steps</div>
          {form.steps.map((step,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:"#374151",border:"1px solid #4b5563",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#9ca3af",flexShrink:0}}>{i+1}</div>
              <input style={{...inp,flex:1}} placeholder="Action" value={step.action} onChange={e=>ss(i,"action",e.target.value)}/>
              <input style={{...inp,flex:1}} placeholder="Expected result" value={step.expected} onChange={e=>ss(i,"expected",e.target.value)}/>
              <button onClick={()=>rs(i)} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:18}}>x</button>
            </div>
          ))}
          <button onClick={as} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:6,padding:"7px 14px",fontSize:13,cursor:"pointer"}}>+ Add step</button>
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:14,fontWeight:700,color:"#f9fafb",marginBottom:12}}>Attachments</div>
          <div style={{display:"flex",borderBottom:"1px solid #374151",marginBottom:12}}>{["Links","Screenshots","Scripts"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:tab===t?"2px solid #3b82f6":"2px solid transparent",color:tab===t?"#3b82f6":"#9ca3af",padding:"6px 14px",fontSize:13,cursor:"pointer"}}>{t}</button>)}</div>
          {tab==="Links"?<div>{form.links.map((link,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}><Sel value={link.type} onChange={v=>sl(i,"type",v)} options={LINK_TYPES} style={{width:90,flexShrink:0}}/><input style={{...inp,flex:1}} placeholder="URL" value={link.url} onChange={e=>sl(i,"url",e.target.value)}/><button onClick={()=>rl(i)} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:18}}>x</button></div>)}<button onClick={al} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:6,padding:"7px 14px",fontSize:13,cursor:"pointer"}}>+ Add link</button></div>
          :<div style={{color:"#6b7280",fontSize:13,padding:"12px 0"}}>Not available in this demo.</div>}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onCancel} style={{background:"none",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:7,padding:"9px 20px",fontSize:13,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave({...form,status:"draft"})} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:7,padding:"9px 20px",fontSize:13,cursor:"pointer"}}>Save as draft</button>
          <button onClick={()=>onSave({...form,status:"active"})} style={{background:"#3b82f6",border:"none",color:"#fff",borderRadius:7,padding:"9px 20px",fontSize:13,cursor:"pointer",fontWeight:600}}>Save test case</button>
        </div>
      </div>
    </>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({teams,runs,onNavigate}){
  const ac=Object.values(teams).flatMap(t=>t.cases||[]);
  const total=ac.length,passed=ac.filter(c=>c.status==="passed").length,crit=ac.filter(c=>c.markAsCritical).length;
  const pr=total>0?Math.round((passed/total)*100):0;
  const tr=Object.values(runs).flat().length;
  return (
    <div style={{flex:1,overflowY:"auto",padding:"40px 40px 60px"}}>
      <div style={{background:"linear-gradient(135deg,#1e3a5f 0%,#1f2937 60%,#2d1b4e 100%)",border:"1px solid #374151",borderRadius:16,padding:"36px 40px",marginBottom:32,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:180,height:180,borderRadius:"50%",background:"rgba(59,130,246,.08)",pointerEvents:"none"}}/>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(34,197,94,.12)",border:"1px solid rgba(34,197,94,.3)",borderRadius:20,padding:"4px 12px",marginBottom:14}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:"#4ade80"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"#4ade80",letterSpacing:".05em"}}>SHARED WORKSPACE</span>
        </div>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:".1em",color:"#60a5fa",marginBottom:10,textTransform:"uppercase"}}>Welcome to</div>
        <div style={{fontSize:30,fontWeight:800,color:"#f9fafb",marginBottom:8,lineHeight:1.2}}>QA Hub</div>
        <div style={{fontSize:14,color:"#9ca3af",maxWidth:520,lineHeight:1.6,marginBottom:24}}>Shared workspace for Ticketing, Travel, and Compete.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {Object.entries(teams).map(([name,t])=>(
            <button key={name} onClick={()=>onNavigate(name)} style={{background:t.color+"22",border:`1.5px solid ${t.color}55`,color:t.color,borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
              <span style={{width:22,height:22,borderRadius:5,background:t.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>{name[0]}</span>{name}
              <span style={{fontSize:11,background:"rgba(0,0,0,.2)",borderRadius:10,padding:"1px 7px",color:"#e5e7eb"}}>{(t.cases||[]).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:32}}>
        {[{label:"Total cases",value:total,color:"#60a5fa",icon:"📋"},{label:"Pass rate",value:`${pr}%`,color:"#4ade80",icon:"✅"},{label:"Critical",value:crit,color:"#ef4444",icon:"🚨"},{label:"Test runs",value:tr,color:"#a855f7",icon:"▶️"}].map(s=>(
          <div key={s.label} style={{background:"#1f2937",border:"1px solid #374151",borderRadius:12,padding:"18px 20px"}}>
            <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
            <div style={{fontSize:26,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{marginBottom:32}}>
        <div style={{fontSize:13,fontWeight:700,color:"#9ca3af",letterSpacing:".05em",textTransform:"uppercase",marginBottom:14}}>Team Workspaces</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {Object.entries(teams).map(([name,t])=>{
            const tc=t.cases||[],p=tc.filter(c=>c.status==="passed").length,f=tc.filter(c=>c.status==="failed").length,a=tc.filter(c=>c.status==="active").length,cr=tc.filter(c=>c.markAsCritical).length;
            const nr=(Array.isArray(runs[name])?runs[name]:[]).length;
            return (
              <div key={name} onClick={()=>onNavigate(name)} style={{background:"#1f2937",border:`1px solid ${t.color}33`,borderRadius:12,padding:20,cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=t.color+"99"} onMouseLeave={e=>e.currentTarget.style.borderColor=t.color+"33"}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <span style={{width:36,height:36,borderRadius:9,background:t.color+"22",border:`1.5px solid ${t.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:t.color}}>{name[0]}</span>
                  <div><div style={{fontSize:14,fontWeight:700,color:"#f9fafb"}}>{name}</div><div style={{fontSize:11,color:"#6b7280"}}>{(t.suites||[]).length} suites · {nr} runs</div></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[["Total",tc.length,"#9ca3af"],["Active",a,"#60a5fa"],["Passed",p,"#4ade80"],["Failed",f,"#f87171"]].map(([l,v,c])=>(
                    <div key={l} style={{background:"#111827",borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:16,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:11,color:"#4b5563"}}>{l}</div></div>
                  ))}
                </div>
                {cr>0&&<div style={{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",borderRadius:6,padding:"5px 10px",fontSize:11,color:"#f87171",fontWeight:600,marginBottom:8}}>⚠ {cr} critical cases</div>}
                <div style={{fontSize:12,color:t.color,fontWeight:600}}>Open workspace</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── TEAM EDITOR ───────────────────────────────────────────────────────────────
const TEAM_COLORS=["#3b82f6","#22c55e","#a855f7","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];
function TeamEditor({teams,onSave,onClose}){
  const [list,setList]=useState(()=>Object.entries(teams).map(([name,t])=>({name,color:t.color,orig:name})));
  const [newName,setNewName]=useState(""),[newColor,setNewColor]=useState(TEAM_COLORS[3]);
  const [editIdx,setEditIdx]=useState(null),[editVal,setEditVal]=useState("");
  const inp={background:"#374151",border:"1px solid #4b5563",borderRadius:6,color:"#f9fafb",padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"inherit"};
  const add=()=>{const t=newName.trim();if(!t||list.find(x=>x.name===t))return;setList(l=>[...l,{name:t,color:newColor,orig:null}]);setNewName("");};
  const remove=i=>setList(l=>l.filter((_,j)=>j!==i));
  const startEdit=(i,f)=>{setEditIdx({i,f});setEditVal(list[i][f]);};
  const commitEdit=()=>{if(!editIdx)return;const{i,f}=editIdx;setList(l=>l.map((x,j)=>j===i?{...x,[f]:editVal}:x));setEditIdx(null);};
  const handleSave=()=>{const nt={};list.forEach(item=>{const od=item.orig?teams[item.orig]:{suites:[],cases:[]};nt[item.name]={...od,color:item.color};});onSave(nt);};
  return (
    <div>
      <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #374151"}}>
        <div style={{fontSize:17,fontWeight:700,color:"#f9fafb"}}>Manage Teams</div>
        <div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>Add, rename, recolor or remove teams. Removing a team deletes all its cases.</div>
      </div>
      <div style={{padding:"20px 24px 24px"}}>
        <div style={{marginBottom:16}}>
          {list.map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,background:"#111827",borderRadius:8,padding:"10px 12px",border:"1px solid #374151"}}>
              <div style={{position:"relative"}}>
                <div style={{width:28,height:28,borderRadius:7,background:item.color,cursor:"pointer",border:"2px solid rgba(255,255,255,.15)"}} onClick={()=>startEdit(i,"color")} title="Change color"/>
                {editIdx?.i===i&&editIdx?.f==="color"&&(
                  <div style={{position:"absolute",top:34,left:0,zIndex:10,background:"#1f2937",border:"1px solid #374151",borderRadius:8,padding:8,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                    {TEAM_COLORS.map(c=><div key={c} style={{width:22,height:22,borderRadius:5,background:c,cursor:"pointer",border:item.color===c?"2px solid #fff":"2px solid transparent"}} onClick={()=>{setList(l=>l.map((x,j)=>j===i?{...x,color:c}:x));setEditIdx(null);}}/>)}
                  </div>
                )}
              </div>
              {editIdx?.i===i&&editIdx?.f==="name"
                ?<input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditIdx(null);}} style={{...inp,flex:1,padding:"5px 10px"}}/>
                :<span onClick={()=>startEdit(i,"name")} style={{flex:1,fontSize:13,color:"#f9fafb",cursor:"text"}}>{item.name}</span>
              }
              <span style={{fontSize:10,background:"#374151",color:"#6b7280",borderRadius:10,padding:"2px 8px"}}>{item.orig?(teams[item.orig]?.cases?.length||0)+" cases":"new"}</span>
              {list.length>1&&<button onClick={()=>remove(i)} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:16}}>×</button>}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:24,alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <div style={{width:36,height:36,borderRadius:7,background:newColor,cursor:"pointer",border:"2px solid rgba(255,255,255,.15)"}} onClick={()=>setEditIdx(editIdx?.f==="newcolor"?null:{f:"newcolor"})}/>
            {editIdx?.f==="newcolor"&&(
              <div style={{position:"absolute",top:42,left:0,zIndex:10,background:"#1f2937",border:"1px solid #374151",borderRadius:8,padding:8,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                {TEAM_COLORS.map(c=><div key={c} style={{width:22,height:22,borderRadius:5,background:c,cursor:"pointer",border:newColor===c?"2px solid #fff":"2px solid transparent"}} onClick={()=>{setNewColor(c);setEditIdx(null);}}/>)}
              </div>
            )}
          </div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="New team name…" style={{...inp,flex:1}}/>
          <button onClick={add} style={{background:newColor,border:"none",color:"#fff",borderRadius:7,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Add</button>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{background:"none",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:7,padding:"9px 20px",fontSize:13,cursor:"pointer"}}>Cancel</button>
          <button onClick={handleSave} style={{background:"#3b82f6",border:"none",color:"#fff",borderRadius:7,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save teams</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function QAHub(){
  const skipSave=useRef(true);
  const skipRunSave=useRef(true);
  const skipRunRemoteToastRef=useRef(true);
  const runsRemoteFirstSnapshotRef=useRef(true);
  const skipHashRef=useRef(false);

  const [teams,setTeams]=useState(null);
  const [runs,setRuns]=useState({Ticketing:[],Travel:[],Compete:[]});
  const [storageReady,setStorageReady]=useState(false);
  const [activeTeam,setActiveTeam]=useState(()=>readHash(window.location.hash).team);
  const [activeNav,setActiveNav]=useState(()=>readHash(window.location.hash).nav);
  const [activeSuite,setActiveSuite]=useState(()=>readHash(window.location.hash).suite);
  const [modal,setModal]=useState(null);
  const [showCsvExport,setShowCsvExport]=useState(false);
  const csvImportRef=useRef(null);
  const [activeRun,setActiveRun]=useState(null);
  const [previewCase,setPreviewCase]=useState(null);
  const [filterPri,setFilterPri]=useState("All");
  const [search,setSearch]=useState("");
  const [collapsed,setCollapsed]=useState(false);
  const [toast,setToast]=useState(null);
  const [lastSaved,setLastSaved]=useState(null);

  const showToast=useCallback((msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);},[]);

  useEffect(()=>{
    (async()=>{
      let fresh=JSON.parse(JSON.stringify(TEAMS_DEFAULT));
      try{
        const vr=await storageAPI.get(VERSION_KEY);
        if(!vr?.value||vr.value!==DATA_VERSION){
          // First deploy after version bump — write fixed cases to Firebase
          fresh={...fresh,Ticketing:{...fresh.Ticketing,cases:REGRESSION_CASES}};
          try{
            const prev=await storageAPI.get(STORAGE_KEY);
            if(prev?.value){
              const sv=JSON.parse(prev.value);
              // Preserve Travel and Compete data from previous storage
              Object.keys(sv).forEach(k=>{if(k!=="Ticketing"&&sv[k]?.cases)fresh[k]=sv[k];});
            }
          }catch{/* optional merge */}
          await storageAPI.set(STORAGE_KEY,JSON.stringify(fresh));
          await storageAPI.set(VERSION_KEY,DATA_VERSION);
        }else{
          // Version matches — read Firebase as source of truth
          const r=await storageAPI.get(STORAGE_KEY);
          if(r?.value)fresh=JSON.parse(r.value);
        }
      }catch{/* initial load optional */}
      skipSave.current=false;
      setTeams(normalizeTeams(fresh));
      setStorageReady(true);
    })();
  },[]);

  useEffect(()=>{
    (async()=>{
      try{const r=await storageAPI.get(RUNS_KEY);if(r?.value)setRuns(normalizeRuns(JSON.parse(r.value)));}catch{/* runs load optional */}
      skipRunSave.current=false;
    })();
  },[]);

  useEffect(()=>{
    if(!storageReady)return;
    const unsubscribe=storageAPI.subscribe(RUNS_KEY,(r)=>{
      try{
        if(!r?.value)return;
        const rem=normalizeRuns(JSON.parse(r.value));
        setRuns(prev=>{
          const equal=JSON.stringify(prev)===JSON.stringify(rem);
          const isFirst=runsRemoteFirstSnapshotRef.current;
          if(isFirst){
            runsRemoteFirstSnapshotRef.current=false;
            if(equal){
              /* First snapshot matches local state (e.g. after get) — end suppress window without faking a skip */
              skipRunRemoteToastRef.current=false;
              return prev;
            }
            if(skipRunRemoteToastRef.current){
              skipRunRemoteToastRef.current=false;
              return rem;
            }
            showToast("Run updated by teammate","info");
            skipRunRemoteToastRef.current=false;
            return rem;
          }
          /* Duplicate RTDB snapshots: do not clear skipRunRemoteToastRef here — that consumed the guard with no toast skipped. */
          if(equal)return prev;
          if(skipRunRemoteToastRef.current){
            skipRunRemoteToastRef.current=false;
            return rem;
          }
          showToast("Run updated by teammate","info");
          skipRunRemoteToastRef.current=false;
          return rem;
        });
      }catch{/* parse optional */}
    });
    return()=>unsubscribe();
  },[storageReady,showToast]);

  useEffect(()=>{
    if(!storageReady||!teams||skipSave.current)return;
    (async()=>{try{await storageAPI.set(STORAGE_KEY,JSON.stringify(teams));setLastSaved(new Date());}catch{showToast("Failed to save","error");}})();
  },[teams,storageReady,showToast]);

  useEffect(()=>{
    if(skipRunSave.current)return;
    (async()=>{try{await storageAPI.set(RUNS_KEY,JSON.stringify(runs));}catch{/* save optional */}})();
  },[runs]);

  useEffect(()=>{
    const onHash=()=>{
      if(skipHashRef.current){skipHashRef.current=false;return;}
      const{team,nav,suite}=readHash(window.location.hash);
      setActiveTeam(team);setActiveNav(nav);setActiveSuite(suite);
      setActiveRun(null);setPreviewCase(null);
    };
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);

  if(!teams)return(
    <div style={{height:"100vh",background:"#111827",display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontFamily:"sans-serif",flexDirection:"column",gap:12}}>
      <div style={{width:36,height:36,border:"3px solid #374151",borderTop:"3px solid #3b82f6",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:13}}>Loading shared workspace</div>
    </div>
  );

  const team=normalizeTeam(teams[activeTeam]);
  const allCases=team.cases;
  const teamRuns=Array.isArray(runs[activeTeam])?runs[activeTeam]:[];

  const displayed=allCases.filter(c=>{
    if(activeNav==="Critical issues"&&!c.markAsCritical)return false;
    if(activeSuite&&c.suite!==activeSuite)return false;
    if(filterPri!=="All"&&c.priority!==filterPri)return false;
    if(search&&!c.title.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const updTeam=(name,fn)=>setTeams(ts=>({...ts,[name]:{...ts[name],cases:fn(ts[name].cases)}}));
  const saveCase=data=>{if(modal?.edit){updTeam(activeTeam,cs=>cs.map(c=>c.id===modal.edit.id?{...data,id:c.id,stepStatuses:c.stepStatuses||[]}:c));showToast("Updated");}else{updTeam(activeTeam,cs=>[...cs,{...data,id:Date.now(),stepStatuses:[]}]);showToast("Saved");}setModal(null);};
  const saveSuites=ns=>{setTeams(ts=>({...ts,[activeTeam]:{...ts[activeTeam],suites:ns}}));if(activeSuite&&!ns.includes(activeSuite))setActiveSuite(null);setModal(null);showToast("Suites updated");};
  const saveTeams=nt=>{const first=Object.keys(nt)[0];setTeams(nt);if(!nt[activeTeam]){setActiveTeam(first);setActiveSuite(null);setPreviewCase(null);}setModal(null);showToast("Teams updated");};
  const handleStepStatusChange=(caseId,newStatuses)=>{updTeam(activeTeam,cs=>cs.map(c=>c.id===caseId?{...c,stepStatuses:newStatuses}:c));setPreviewCase(prev=>prev?.id===caseId?{...prev,stepStatuses:newStatuses}:prev);};
  const delCase=id=>{updTeam(activeTeam,cs=>cs.filter(c=>c.id!==id));if(previewCase?.id===id)setPreviewCase(null);showToast("Deleted");};
  const cycleSt=id=>{const cy={draft:"active",active:"passed",passed:"failed",failed:"draft"};updTeam(activeTeam,cs=>cs.map(c=>c.id===id?{...c,status:cy[c.status]}:c));};
  const push=(team,nav,suite=null)=>{
    /* eslint-disable react-hooks/immutability -- hash API + ref guard for sync routing */
    skipHashRef.current=true;
    window.location.hash=buildHash(team,nav,suite);
    /* eslint-enable react-hooks/immutability */
  };
  const saveRun=run=>{setRuns(r=>({...r,[activeTeam]:[...(r[activeTeam]||[]),run]}));setModal(null);setActiveRun(run);push(activeTeam,'Test runs');setActiveNav("Test runs");showToast("Run started");};
  const updRun=u=>{setRuns(r=>({...r,[activeTeam]:(r[activeTeam]||[]).map(x=>x.id===u.id?u:x)}));setActiveRun(u);};
  const delRun=id=>{setRuns(r=>({...r,[activeTeam]:(r[activeTeam]||[]).filter(x=>x.id!==id)}));if(activeRun?.id===id)setActiveRun(null);};
  const goTeam=name=>{push(name,'Test cases');setActiveTeam(name);setActiveSuite(null);setActiveNav("Test cases");setSearch("");setFilterPri("All");setActiveRun(null);setPreviewCase(null);};
  const resetAll=async()=>{if(!window.confirm("Reset all shared data?"))return;try{await storageAPI.delete(STORAGE_KEY);await storageAPI.delete(RUNS_KEY);setTeams(JSON.parse(JSON.stringify(TEAMS_DEFAULT)));setRuns({Ticketing:[],Travel:[],Compete:[]});showToast("Data reset");}catch{showToast("Failed","error");}};

  const runCsvImport=e=>{
    const input=e.target;
    const f=input.files?.[0];
    if(!f){input.value="";return;}
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const matrix=parseCsvToMatrix(String(reader.result??""));
        if(matrix.length<2){showToast("CSV has no data rows","error");input.value="";return;}
        const kind=detectCsvFormat(matrix[0]);
        if(!kind){showToast("Unknown CSV format — export from QA Hub or use Xray/Zephyr templates","error");input.value="";return;}
        const res=importCasesFromMatrix(matrix,kind);
        if(!res.ok){showToast(res.error,"error");input.value="";return;}
        if(!window.confirm(`Import ${res.count} test case(s)? New IDs will be assigned. Teams/suites are created from Team/Component/Folder columns.`))return;
        setTeams(ts=>applyCsvImportMerge(ts,res.merge));
        showToast(`Imported ${res.count} case(s)`);
      }catch{showToast("Could not parse CSV","error");}
      input.value="";
    };
    reader.readAsText(f);
  };

  const isHome=activeNav==="Home"&&!activeSuite;

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#111827",color:"#f9fafb",overflow:"hidden"}}>
      {/* Sidebar */}
      <div style={{width:collapsed?52:210,background:"#1f2937",borderRight:"1px solid #374151",display:"flex",flexDirection:"column",flexShrink:0,transition:"width .2s",overflow:"hidden"}}>
        <div style={{padding:"16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #374151",flexShrink:0}}>
          {!collapsed&&<span style={{fontSize:15,fontWeight:700,color:"#f9fafb",whiteSpace:"nowrap"}}>QA Hub</span>}
          <button onClick={()=>setCollapsed(s=>!s)} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:16,padding:2,marginLeft:collapsed?"auto":0}}>{collapsed?"»":"«"}</button>
        </div>
        <div style={{padding:"10px 8px 6px",borderBottom:"1px solid #374151"}}>
          {!collapsed&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingLeft:4,paddingRight:2,marginBottom:6}}><div style={{fontSize:10,fontWeight:600,color:"#6b7280",letterSpacing:".08em"}}>TEAMS</div><button onClick={()=>setModal("teams")} title="Manage teams" style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:12,padding:"1px 4px",borderRadius:4}} onMouseEnter={e=>{e.currentTarget.style.color="#d1d5db";e.currentTarget.style.background="#374151";}} onMouseLeave={e=>{e.currentTarget.style.color="#6b7280";e.currentTarget.style.background="none";}}>⚙</button></div>}
          {Object.entries(teams).map(([name,t])=>(
            <button key={name} onClick={()=>goTeam(name)} title={name} style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:activeTeam===name&&!isHome?"rgba(255,255,255,.08)":"none",border:`1px solid ${activeTeam===name&&!isHome?t.color+"66":"transparent"}`,borderRadius:7,padding:"8px 10px",color:activeTeam===name&&!isHome?"#f9fafb":"#9ca3af",fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:3,boxSizing:"border-box"}}>
              <span style={{width:28,height:28,borderRadius:7,background:t.color+"22",border:`1.5px solid ${t.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:t.color,flexShrink:0}}>{name[0]}</span>
              {!collapsed&&<><span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</span><span style={{marginLeft:"auto",fontSize:10,background:"#374151",color:"#9ca3af",borderRadius:10,padding:"1px 6px"}}>{(t.cases||[]).length}</span></>}
            </button>
          ))}
        </div>
        {!collapsed&&(
          <div style={{padding:"10px 8px",overflowY:"auto",flex:1}}>
            <div style={{fontSize:10,fontWeight:600,color:"#6b7280",letterSpacing:".08em",marginBottom:6,paddingLeft:4}}>PROJECT</div>
            {NAV.map((n,i)=>(
              <button key={n} onClick={()=>{push(activeTeam,n,null);setActiveNav(n);setActiveSuite(null);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:activeNav===n&&!activeSuite?"#374151":"none",border:"none",borderRadius:6,padding:"7px 10px",color:activeNav===n&&!activeSuite?"#f9fafb":"#9ca3af",fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:2}}>
                <span style={{fontSize:14}}>{NAV_ICONS[i]}</span>{n}
                {n==="Test runs"&&teamRuns.length>0&&<span style={{marginLeft:"auto",fontSize:10,background:"#374151",color:"#9ca3af",borderRadius:10,padding:"1px 6px"}}>{teamRuns.length}</span>}
              </button>
            ))}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingLeft:4,paddingRight:2,marginTop:12,marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:600,color:"#6b7280",letterSpacing:".08em"}}>SUITES</div>
              <button onClick={()=>setModal("suites")} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:13,padding:"1px 4px",borderRadius:4}}
                onMouseEnter={e=>{e.currentTarget.style.color="#d1d5db";e.currentTarget.style.background="#374151";}} onMouseLeave={e=>{e.currentTarget.style.color="#6b7280";e.currentTarget.style.background="none";}}>✎</button>
            </div>
            {(team.suites||[]).length===0&&<button onClick={()=>setModal("suites")} style={{background:"none",border:"1px dashed #374151",borderRadius:6,color:"#4b5563",fontSize:12,padding:"6px 10px",cursor:"pointer",width:"100%",textAlign:"left"}}>+ Add a suite</button>}
            {(team.suites||[]).map(s=>(
              <button key={s} onClick={()=>{const ns=activeSuite===s?null:s;push(activeTeam,'Test cases',ns);setActiveSuite(ns);setActiveNav("Test cases");}} style={{display:"block",width:"100%",background:activeSuite===s?"#374151":"none",border:"none",borderRadius:6,padding:"7px 10px",color:activeSuite===s?"#f9fafb":"#9ca3af",fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s}</button>
            ))}
          </div>
        )}
        {!collapsed&&(
          <div style={{borderTop:"1px solid #374151",padding:"10px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#4ade80",flexShrink:0}}/>
              <span style={{fontSize:11,color:"#6b7280"}}>Shared · Auto-saving</span>
            </div>
            {lastSaved&&<div style={{fontSize:10,color:"#4b5563",marginBottom:6}}>Saved {lastSaved.toLocaleTimeString()}</div>}
            <input ref={csvImportRef} type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={runCsvImport}/>
            <button type="button" onClick={()=>setShowCsvExport(true)} style={{background:"#1e3a5f",border:"1px solid #3b82f655",color:"#60a5fa",borderRadius:5,padding:"4px 10px",fontSize:11,cursor:"pointer",width:"100%",marginBottom:6,fontWeight:600}}>Export CSV</button>
            <button type="button" onClick={()=>csvImportRef.current?.click()} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:5,padding:"4px 10px",fontSize:11,cursor:"pointer",width:"100%",marginBottom:6}}>Import CSV</button>
            <button onClick={resetAll} style={{background:"none",border:"1px solid #374151",color:"#6b7280",borderRadius:5,padding:"4px 10px",fontSize:11,cursor:"pointer",width:"100%"}}>Reset all data</button>
          </div>
        )}
      </div>

      {/* Main */}
      <div key={activeNav+activeTeam+(activeSuite||"")} className="view-fade" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {isHome?(
          <HomeScreen teams={teams} runs={runs} onNavigate={goTeam}/>
        ):(
          <>
            <div style={{background:"#1f2937",borderBottom:"1px solid #374151",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button onClick={()=>{push(activeTeam,'Home');setActiveNav("Home");}} style={{background:"none",border:"none",color:"#6b7280",fontSize:18,cursor:"pointer",padding:0,lineHeight:1}}>⌂</button>
                <span style={{color:"#374151"}}>›</span>
                <span style={{width:32,height:32,borderRadius:8,background:team.color+"22",border:`1.5px solid ${team.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:team.color}}>{activeTeam[0]}</span>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#f9fafb"}}>{activeTeam} — {activeNav==="Test runs"?"Test runs":activeNav==="Critical issues"?"Critical issues":activeSuite||"All test cases"}</div>
                  <div style={{fontSize:12,color:"#6b7280"}}>{activeNav==="Test runs"?`${teamRuns.length} runs`:`${displayed.length} cases`}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {activeNav==="Test runs"?(
                  <button onClick={()=>setModal("newrun")} style={{background:team.color,border:"none",color:"#fff",borderRadius:7,padding:"8px 16px",fontSize:13,cursor:"pointer",fontWeight:600}}>+ New Run</button>
                ):(
                  <>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search" style={{background:"#374151",border:"1px solid #4b5563",borderRadius:6,padding:"7px 12px",color:"#f9fafb",fontSize:13,width:150,outline:"none"}}/>
                    <Sel value={filterPri} onChange={setFilterPri} options={["All",...PRIORITIES]} style={{}}/>
                    <button onClick={()=>setModal("suites")} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:7,padding:"7px 10px",fontSize:13,cursor:"pointer"}}>🗂</button>
                    <button onClick={()=>setModal("add")} style={{background:team.color,border:"none",color:"#fff",borderRadius:7,padding:"8px 14px",fontSize:13,cursor:"pointer",fontWeight:600}}>+ New</button>
                  </>
                )}
              </div>
            </div>

            {activeNav!=="Test runs"&&(
              <div style={{background:"#1a2332",borderBottom:"1px solid #374151",padding:"7px 24px",display:"flex",gap:20}}>
                {[["Total",allCases.length,"#9ca3af"],["Critical",allCases.filter(c=>c.markAsCritical).length,"#ef4444"],["Active",allCases.filter(c=>c.status==="active").length,"#60a5fa"],["Passed",allCases.filter(c=>c.status==="passed").length,"#4ade80"],["Failed",allCases.filter(c=>c.status==="failed").length,"#f87171"]].map(([l,v,c])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:14,fontWeight:700,color:c}}>{v}</span><span style={{fontSize:11,color:"#6b7280"}}>{l}</span></div>
                ))}
              </div>
            )}

            <div style={{flex:1,display:"flex",overflow:"hidden"}}>
              {activeNav==="Test runs"&&!activeRun&&<RunsList runs={teamRuns} teamColor={team.color} onOpen={r=>setActiveRun(r)} onNew={()=>setModal("newrun")} onDelete={delRun}/>}
              {activeNav==="Test runs"&&activeRun&&<RunView run={activeRun} cases={allCases} onUpdate={updRun} onClose={()=>setActiveRun(null)}/>}
              {activeNav!=="Test runs"&&(
                <div style={{flex:1,display:"flex",overflow:"hidden"}}>
                  <div style={{flex:1,overflowY:"auto",padding:20,borderRight:previewCase?"1px solid #374151":"none"}}>
                    {displayed.length===0&&<div style={{textAlign:"center",paddingTop:60}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{color:"#4b5563",fontSize:14}}>No test cases. Create one!</div></div>}
                    {displayed.map(c=>{
                      const badge=sb(c.status);
                      const isActive=previewCase?.id===c.id;
                      return (
                        <div key={c.id} style={{background:isActive?"#1e3a5f":"#1f2937",border:`1px solid ${isActive?team.color+"99":"#374151"}`,borderRadius:10,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"flex-start",gap:12,transition:"border-color .15s"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                              <button onClick={()=>setPreviewCase(isActive?null:c)} style={{background:"none",border:"none",padding:0,fontSize:14,fontWeight:600,color:isActive?"#93c5fd":"#f9fafb",cursor:"pointer",textAlign:"left",lineHeight:1.4}}>{c.title}</button>
                              {c.markAsCritical&&<span style={{fontSize:10,background:"rgba(239,68,68,.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,.3)",borderRadius:4,padding:"2px 6px",fontWeight:600}}>CRITICAL</span>}
                            </div>
                            <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,color:"#6b7280"}}>
                              <span style={{color:pc(c.priority)}}>● {c.priority}</span>
                              <span>{c.suite}</span><span>{c.assignee}</span>
                              <span>{(c.steps||[]).length} steps</span>
                              {(c.links||[]).length>0&&<span>🔗 {(c.links||[]).length}</span>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                            <button onClick={()=>cycleSt(c.id)} style={{background:badge.bg,color:badge.text,border:"none",borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{badge.label}</button>
                            <button onClick={()=>{setModal({edit:c});setPreviewCase(null);}} style={{background:"#374151",border:"1px solid #4b5563",color:"#d1d5db",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Edit</button>
                            <button onClick={()=>delCase(c.id)} style={{background:"none",border:"1px solid #4b5563",color:"#6b7280",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>x</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {previewCase&&(
                    <div style={{width:500,flexShrink:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                      <CaseDetail key={previewCase.id} c={previewCase} onClose={()=>setPreviewCase(null)} onEdit={()=>{setModal({edit:previewCase});setPreviewCase(null);}} onStepStatusChange={handleStepStatusChange}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showCsvExport&&<CsvModal teams={teams} onClose={()=>setShowCsvExport(false)} showToast={showToast}/>}
      {modal==="teams"&&<Overlay onClose={()=>setModal(null)} width={520}><TeamEditor teams={teams} onSave={saveTeams} onClose={()=>setModal(null)}/></Overlay>}
      {modal==="suites"&&<Overlay onClose={()=>setModal(null)} width={520}><SuiteEditor teamName={activeTeam} teamColor={team.color} suites={team.suites} onSave={saveSuites} onClose={()=>setModal(null)}/></Overlay>}
      {modal==="newrun"&&<Overlay onClose={()=>setModal(null)} width={680}><NewRunForm cases={allCases} teamName={activeTeam} teamColor={team.color} onSave={saveRun} onCancel={()=>setModal(null)}/></Overlay>}
      {modal==="add"&&<Overlay onClose={()=>setModal(null)}><TestCaseForm initial={null} suites={team.suites} teamName={activeTeam} onSave={saveCase} onCancel={()=>setModal(null)}/></Overlay>}
      {modal?.edit&&<Overlay onClose={()=>setModal(null)}><TestCaseForm initial={modal.edit} suites={team.suites} teamName={activeTeam} onSave={saveCase} onCancel={()=>setModal(null)}/></Overlay>}
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
}
