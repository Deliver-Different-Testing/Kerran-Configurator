/**
 * Suggested data-binding paths offered in the field properties panel.
 *
 * Mirrors every field exposed by the DeliverDifferentReporting report models, grouped by
 * report so the field mapper offers the same options those reports render. Free-text is
 * still allowed in the Autocomplete — these are suggestions, not a closed set.
 *
 * Path convention: `<reportKey>.<field>` in camelCase. Repeating rows (line items, job
 * rows, etc.) are namespaced under a singular collection segment (e.g. `courierJobDetail.row.*`).
 */
export interface DataBinding {
  /** Report the field belongs to — used as the Autocomplete group header. */
  group: string;
  /** Human-readable field name shown in the dropdown. */
  label: string;
  /** Binding path written to the field's `dataBinding`. */
  value: string;
}

const baseBindings: readonly DataBinding[] = [
  // ── Proof of Delivery (POD) ───────────────────────────────────────────────
  { group: 'Proof of Delivery', label: 'Job number', value: 'pod.jobNumber' },
  { group: 'Proof of Delivery', label: 'Client ref A', value: 'pod.clientRefA' },
  { group: 'Proof of Delivery', label: 'Client ref B', value: 'pod.clientRefB' },
  { group: 'Proof of Delivery', label: 'ETA', value: 'pod.eta' },
  { group: 'Proof of Delivery', label: 'Delivery status', value: 'pod.deliveryStatus' },
  { group: 'Proof of Delivery', label: 'Account', value: 'pod.account' },
  { group: 'Proof of Delivery', label: 'Service type', value: 'pod.serviceType' },
  { group: 'Proof of Delivery', label: 'Goods ready', value: 'pod.goodsReady' },
  { group: 'Proof of Delivery', label: 'Pickup name', value: 'pod.pickupName' },
  { group: 'Proof of Delivery', label: 'Pickup address', value: 'pod.pickupAddress' },
  { group: 'Proof of Delivery', label: 'Pickup extra info', value: 'pod.pickupExtraInfo' },
  { group: 'Proof of Delivery', label: 'Pickup department', value: 'pod.pickupDepartment' },
  { group: 'Proof of Delivery', label: 'Delivery name', value: 'pod.deliveryName' },
  { group: 'Proof of Delivery', label: 'Delivery address', value: 'pod.deliveryAddress' },
  { group: 'Proof of Delivery', label: 'Delivery extra info', value: 'pod.deliveryExtraInfo' },
  { group: 'Proof of Delivery', label: 'Delivery department', value: 'pod.deliveryDepartment' },
  { group: 'Proof of Delivery', label: 'Courier name', value: 'pod.courierName' },
  { group: 'Proof of Delivery', label: 'Courier vehicle', value: 'pod.courierVehicle' },
  { group: 'Proof of Delivery', label: 'Courier ID', value: 'pod.courierId' },
  { group: 'Proof of Delivery', label: 'GPS latitude', value: 'pod.gpsLatitude' },
  { group: 'Proof of Delivery', label: 'GPS longitude', value: 'pod.gpsLongitude' },
  { group: 'Proof of Delivery', label: 'GPS accuracy (m)', value: 'pod.gpsAccuracyM' },
  { group: 'Proof of Delivery', label: 'POD name', value: 'pod.podName' },
  { group: 'Proof of Delivery', label: 'POD date', value: 'pod.podDate' },
  { group: 'Proof of Delivery', label: 'POD notes', value: 'pod.podNotes' },
  // Signatures + completed time are captured by the driver app and stored by MarsAPI in the per-tenant
  // marsapi S3 bucket (env S3Bucket = urgent-couriers-marsapi-{tenant}-{env}) as base64 → object under
  //   DeliverySignatures/{yyyy}/{MM}/{jobId}-DS   (pickup: PickupSignatures/{yyyy}/{MM}/{jobId}-PS),
  // with the key persisted in JobWorkflowSteps.BlobUrl and the completion timestamp in
  // JobWorkflowSteps.CompletedAt. The consumer render path resolves these per job; an image field takes
  // the (presigned) URL/bytes of that object.
  { group: 'Proof of Delivery', label: 'Delivery signature (image)', value: 'pod.signatureImage' },
  { group: 'Proof of Delivery', label: 'Pickup signature (image)', value: 'pod.pickupSignatureImage' },
  { group: 'Proof of Delivery', label: 'Delivered / completed time', value: 'pod.deliveredTime' },
  { group: 'Proof of Delivery', label: 'Show price', value: 'pod.showPrice' },
  { group: 'Proof of Delivery', label: 'Service description', value: 'pod.serviceDescription' },
  { group: 'Proof of Delivery', label: 'Service price', value: 'pod.servicePrice' },

  // ── Buyer Created Tax Invoice ─────────────────────────────────────────────
  { group: 'Buyer Created Tax Invoice', label: 'Batch ID', value: 'buyerInvoice.id' },
  { group: 'Buyer Created Tax Invoice', label: 'Line date', value: 'buyerInvoice.line.date' },
  { group: 'Buyer Created Tax Invoice', label: 'Line ID', value: 'buyerInvoice.line.id' },
  { group: 'Buyer Created Tax Invoice', label: 'Line item ID', value: 'buyerInvoice.line.lineId' },
  { group: 'Buyer Created Tax Invoice', label: 'Period', value: 'buyerInvoice.line.period' },
  { group: 'Buyer Created Tax Invoice', label: 'Period display', value: 'buyerInvoice.line.periodDisplay' },
  { group: 'Buyer Created Tax Invoice', label: 'Account code', value: 'buyerInvoice.line.accountCode' },
  { group: 'Buyer Created Tax Invoice', label: 'Account GST reg no', value: 'buyerInvoice.line.accountGstRegNo' },
  { group: 'Buyer Created Tax Invoice', label: 'Account address', value: 'buyerInvoice.line.accountAddress' },
  { group: 'Buyer Created Tax Invoice', label: 'Entity GST reg no', value: 'buyerInvoice.line.entityGstRegNo' },
  { group: 'Buyer Created Tax Invoice', label: 'Entity address', value: 'buyerInvoice.line.entityAddress' },
  { group: 'Buyer Created Tax Invoice', label: 'Transaction date', value: 'buyerInvoice.line.transactionDate' },
  { group: 'Buyer Created Tax Invoice', label: 'Due date', value: 'buyerInvoice.line.dueDate' },
  { group: 'Buyer Created Tax Invoice', label: 'Narration', value: 'buyerInvoice.line.narration' },
  { group: 'Buyer Created Tax Invoice', label: 'Reference', value: 'buyerInvoice.line.reference' },
  { group: 'Buyer Created Tax Invoice', label: 'Footer narration A', value: 'buyerInvoice.line.footerNarrationA' },
  { group: 'Buyer Created Tax Invoice', label: 'Footer narration B', value: 'buyerInvoice.line.footerNarrationB' },
  { group: 'Buyer Created Tax Invoice', label: 'Footer reference A', value: 'buyerInvoice.line.footerReferenceA' },
  { group: 'Buyer Created Tax Invoice', label: 'Footer reference B', value: 'buyerInvoice.line.footerReferenceB' },
  { group: 'Buyer Created Tax Invoice', label: 'Total', value: 'buyerInvoice.line.total' },
  { group: 'Buyer Created Tax Invoice', label: 'Tax total', value: 'buyerInvoice.line.taxTotal' },
  { group: 'Buyer Created Tax Invoice', label: 'Tax savings', value: 'buyerInvoice.line.taxSavings' },
  { group: 'Buyer Created Tax Invoice', label: 'Tax savings %', value: 'buyerInvoice.line.taxSavingsPercentage' },
  { group: 'Buyer Created Tax Invoice', label: 'Car savings', value: 'buyerInvoice.line.carSavings' },
  { group: 'Buyer Created Tax Invoice', label: 'Grouping (A/B)', value: 'buyerInvoice.line.grouping' },

  // ── Courier Job Summary (Daily) ───────────────────────────────────────────
  { group: 'Courier Job Summary (Daily)', label: 'Courier first name', value: 'courierJobSummary.courier.firstName' },
  { group: 'Courier Job Summary (Daily)', label: 'Courier surname', value: 'courierJobSummary.courier.surname' },
  { group: 'Courier Job Summary (Daily)', label: 'Courier code', value: 'courierJobSummary.courier.courierCode' },
  { group: 'Courier Job Summary (Daily)', label: 'Courier ID', value: 'courierJobSummary.courier.courierId' },
  { group: 'Courier Job Summary (Daily)', label: 'Start date', value: 'courierJobSummary.startDate' },
  { group: 'Courier Job Summary (Daily)', label: 'End date', value: 'courierJobSummary.endDate' },
  { group: 'Courier Job Summary (Daily)', label: 'Row date', value: 'courierJobSummary.row.date' },
  { group: 'Courier Job Summary (Daily)', label: 'Total', value: 'courierJobSummary.row.total' },
  { group: 'Courier Job Summary (Daily)', label: 'Fuel surcharge total', value: 'courierJobSummary.row.fuelSurchargeTotal' },
  { group: 'Courier Job Summary (Daily)', label: 'Total + surcharge', value: 'courierJobSummary.row.totalPlusSurcharge' },
  { group: 'Courier Job Summary (Daily)', label: 'No. of jobs', value: 'courierJobSummary.row.noJobs' },
  { group: 'Courier Job Summary (Daily)', label: 'Average per job', value: 'courierJobSummary.row.avPerJob' },

  // ── Courier Job Summary (Management) ──────────────────────────────────────
  { group: 'Courier Job Summary (Management)', label: 'Courier code', value: 'courierJobSummaryMgmt.courierCode' },
  { group: 'Courier Job Summary (Management)', label: 'First name', value: 'courierJobSummaryMgmt.firstName' },
  { group: 'Courier Job Summary (Management)', label: 'Surname', value: 'courierJobSummaryMgmt.surname' },
  { group: 'Courier Job Summary (Management)', label: 'Date', value: 'courierJobSummaryMgmt.date' },
  { group: 'Courier Job Summary (Management)', label: 'Total', value: 'courierJobSummaryMgmt.total' },
  { group: 'Courier Job Summary (Management)', label: 'Fuel surcharge total', value: 'courierJobSummaryMgmt.fuelSurchargeTotal' },
  { group: 'Courier Job Summary (Management)', label: 'Total + surcharge', value: 'courierJobSummaryMgmt.totalPlusSurcharge' },
  { group: 'Courier Job Summary (Management)', label: 'No. of jobs', value: 'courierJobSummaryMgmt.noJobs' },
  { group: 'Courier Job Summary (Management)', label: 'Average per job', value: 'courierJobSummaryMgmt.avPerJob' },
  { group: 'Courier Job Summary (Management)', label: 'Bonus amount', value: 'courierJobSummaryMgmt.bonusAmount' },
  { group: 'Courier Job Summary (Management)', label: 'Ac late %', value: 'courierJobSummaryMgmt.acLate' },
  { group: 'Courier Job Summary (Management)', label: 'Nt late %', value: 'courierJobSummaryMgmt.ntLate' },

  // ── Courier Job Detail ────────────────────────────────────────────────────
  { group: 'Courier Job Detail', label: 'Courier first name', value: 'courierJobDetail.courier.firstName' },
  { group: 'Courier Job Detail', label: 'Courier surname', value: 'courierJobDetail.courier.surname' },
  { group: 'Courier Job Detail', label: 'Courier code', value: 'courierJobDetail.courier.courierCode' },
  { group: 'Courier Job Detail', label: 'Courier ID', value: 'courierJobDetail.courier.courierId' },
  { group: 'Courier Job Detail', label: 'Start date', value: 'courierJobDetail.startDate' },
  { group: 'Courier Job Detail', label: 'End date', value: 'courierJobDetail.endDate' },
  { group: 'Courier Job Detail', label: 'Row date', value: 'courierJobDetail.row.date' },
  { group: 'Courier Job Detail', label: 'Time', value: 'courierJobDetail.row.time' },
  { group: 'Courier Job Detail', label: 'Job number', value: 'courierJobDetail.row.number' },
  { group: 'Courier Job Detail', label: 'Invoice', value: 'courierJobDetail.row.invoice' },
  { group: 'Courier Job Detail', label: 'Client code', value: 'courierJobDetail.row.clientCode' },
  { group: 'Courier Job Detail', label: 'Our ref', value: 'courierJobDetail.row.ourRef' },
  { group: 'Courier Job Detail', label: 'From', value: 'courierJobDetail.row.from' },
  { group: 'Courier Job Detail', label: 'To', value: 'courierJobDetail.row.to' },
  { group: 'Courier Job Detail', label: 'Weight', value: 'courierJobDetail.row.weight' },
  { group: 'Courier Job Detail', label: 'Van', value: 'courierJobDetail.row.van' },
  { group: 'Courier Job Detail', label: 'Amount', value: 'courierJobDetail.row.amount' },
  { group: 'Courier Job Detail', label: 'Original speed', value: 'courierJobDetail.row.originalSpeed' },
  { group: 'Courier Job Detail', label: 'Speed (short name)', value: 'courierJobDetail.row.shortName' },
  { group: 'Courier Job Detail', label: 'Despatch mins', value: 'courierJobDetail.row.despatchMins' },
  { group: 'Courier Job Detail', label: 'Delivery mins', value: 'courierJobDetail.row.deliveryMins' },
  { group: 'Courier Job Detail', label: 'Pickup time', value: 'courierJobDetail.row.puTime' },
  { group: 'Courier Job Detail', label: 'Late call', value: 'courierJobDetail.row.lateCall' },
  { group: 'Courier Job Detail', label: 'Completed time', value: 'courierJobDetail.row.completedTime' },
  { group: 'Courier Job Detail', label: 'Late mins', value: 'courierJobDetail.row.lateMins' },
  { group: 'Courier Job Detail', label: 'POD name', value: 'courierJobDetail.row.podName' },
  { group: 'Courier Job Detail', label: 'SMS name', value: 'courierJobDetail.row.smsName' },
  { group: 'Courier Job Detail', label: 'Job ID', value: 'courierJobDetail.row.jobId' },
  { group: 'Courier Job Detail', label: 'Speed summary: short name', value: 'courierJobDetail.speed.shortName' },
  { group: 'Courier Job Detail', label: 'Speed summary: no. jobs', value: 'courierJobDetail.speed.noJobs' },
  { group: 'Courier Job Detail', label: 'Speed summary: total', value: 'courierJobDetail.speed.total' },
  { group: 'Courier Job Detail', label: 'Speed summary: avg per job', value: 'courierJobDetail.speed.avPerJob' },
  { group: 'Courier Job Detail', label: 'Speed summary: on-time %', value: 'courierJobDetail.speed.onTimePercent' },
  { group: 'Courier Job Detail', label: 'Speed summary: late jobs', value: 'courierJobDetail.speed.lateJobs' },
  { group: 'Courier Job Detail', label: 'Speed summary: avg mins late', value: 'courierJobDetail.speed.avMinsLate' },
  { group: 'Courier Job Detail', label: 'Total: total jobs', value: 'courierJobDetail.total.totalJobs' },
  { group: 'Courier Job Detail', label: 'Total: total', value: 'courierJobDetail.total.total' },
  { group: 'Courier Job Detail', label: 'Total: fuel surcharge total', value: 'courierJobDetail.total.fuelSurchargeTotal' },
  { group: 'Courier Job Detail', label: 'Total: total + surcharge', value: 'courierJobDetail.total.totalPlusSurcharge' },
  { group: 'Courier Job Detail', label: 'Total: withholding tax', value: 'courierJobDetail.total.withholdingTaxAmount' },
  { group: 'Courier Job Detail', label: 'Total: avg per job', value: 'courierJobDetail.total.avgPerJob' },
  { group: 'Courier Job Detail', label: 'Total: on-time %', value: 'courierJobDetail.total.onTimePercent' },
  { group: 'Courier Job Detail', label: 'Total: total late jobs', value: 'courierJobDetail.total.totalLateJobs' },
  { group: 'Courier Job Detail', label: 'Total: total mins late', value: 'courierJobDetail.total.totalMinsLate' },
  { group: 'Courier Job Detail', label: 'Total: Ac late %', value: 'courierJobDetail.total.acLatePercent' },
  { group: 'Courier Job Detail', label: 'Total: Nt late %', value: 'courierJobDetail.total.ntLatePercent' },

  // ── Courier Fleet Job Summary ─────────────────────────────────────────────
  { group: 'Courier Fleet Job Summary', label: 'Courier fleet', value: 'courierFleetJobSummary.courierFleet' },
  { group: 'Courier Fleet Job Summary', label: 'Courier code', value: 'courierFleetJobSummary.courierCode' },
  { group: 'Courier Fleet Job Summary', label: 'First name', value: 'courierFleetJobSummary.firstName' },
  { group: 'Courier Fleet Job Summary', label: 'Surname', value: 'courierFleetJobSummary.surname' },
  { group: 'Courier Fleet Job Summary', label: 'Date', value: 'courierFleetJobSummary.date' },
  { group: 'Courier Fleet Job Summary', label: 'Total', value: 'courierFleetJobSummary.total' },
  { group: 'Courier Fleet Job Summary', label: 'Fuel surcharge total', value: 'courierFleetJobSummary.fuelSurchargeTotal' },
  { group: 'Courier Fleet Job Summary', label: 'Total + surcharge', value: 'courierFleetJobSummary.totalPlusSurcharge' },
  { group: 'Courier Fleet Job Summary', label: 'Bonus amount', value: 'courierFleetJobSummary.bonusAmount' },
  { group: 'Courier Fleet Job Summary', label: 'No. of jobs', value: 'courierFleetJobSummary.noJobs' },
  { group: 'Courier Fleet Job Summary', label: 'Average per job', value: 'courierFleetJobSummary.avPerJob' },
  { group: 'Courier Fleet Job Summary', label: 'Ac late %', value: 'courierFleetJobSummary.acLate' },
  { group: 'Courier Fleet Job Summary', label: 'Nt late %', value: 'courierFleetJobSummary.ntLate' },
  { group: 'Courier Fleet Job Summary', label: 'Total hours', value: 'courierFleetJobSummary.totalHours' },
  { group: 'Courier Fleet Job Summary', label: 'Total mins', value: 'courierFleetJobSummary.totalMins' },

  // ── Courier Earnings ──────────────────────────────────────────────────────
  { group: 'Courier Earnings', label: 'Start date', value: 'courierEarnings.startDate' },
  { group: 'Courier Earnings', label: 'End date', value: 'courierEarnings.endDate' },
  { group: 'Courier Earnings', label: 'Site name', value: 'courierEarnings.siteName' },
  { group: 'Courier Earnings', label: 'Date', value: 'courierEarnings.row.date' },
  { group: 'Courier Earnings', label: 'Suburb', value: 'courierEarnings.row.suburb' },
  { group: 'Courier Earnings', label: 'Postcode', value: 'courierEarnings.row.postcode' },
  { group: 'Courier Earnings', label: 'Courier name', value: 'courierEarnings.row.courierName' },
  { group: 'Courier Earnings', label: 'Sum of job amount', value: 'courierEarnings.row.sumOfJobAmount' },
  { group: 'Courier Earnings', label: 'Courier payment', value: 'courierEarnings.row.courierPayment' },
  { group: 'Courier Earnings', label: 'Total jobs', value: 'courierEarnings.row.totalJobs' },
  { group: 'Courier Earnings', label: 'Leave base', value: 'courierEarnings.row.leaveBase' },
  { group: 'Courier Earnings', label: 'First delivery', value: 'courierEarnings.row.firstDelivery' },
  { group: 'Courier Earnings', label: 'Last delivery', value: 'courierEarnings.row.lastDelivery' },
  { group: 'Courier Earnings', label: 'In-area time (mins)', value: 'courierEarnings.row.inAreaTime' },
  { group: 'Courier Earnings', label: 'In-area deliveries/hour', value: 'courierEarnings.row.inAreaDelPerHour' },
  { group: 'Courier Earnings', label: 'To/from area (mins)', value: 'courierEarnings.row.toFromArea' },
  { group: 'Courier Earnings', label: 'Load time (mins)', value: 'courierEarnings.row.loadTime' },
  { group: 'Courier Earnings', label: 'Total run time', value: 'courierEarnings.row.totalRunTime' },
  { group: 'Courier Earnings', label: 'Total deliveries/hour', value: 'courierEarnings.row.totalDelPerHour' },
  { group: 'Courier Earnings', label: 'Hourly rate', value: 'courierEarnings.row.hourlyRate' },

  // ── Courier Bonus Journal ─────────────────────────────────────────────────
  { group: 'Courier Bonus Journal', label: 'Start date', value: 'courierBonusJournal.startDate' },
  { group: 'Courier Bonus Journal', label: 'End date', value: 'courierBonusJournal.endDate' },
  { group: 'Courier Bonus Journal', label: 'Courier code', value: 'courierBonusJournal.row.courierCode' },
  { group: 'Courier Bonus Journal', label: 'First name', value: 'courierBonusJournal.row.firstName' },
  { group: 'Courier Bonus Journal', label: 'Surname', value: 'courierBonusJournal.row.surname' },
  { group: 'Courier Bonus Journal', label: 'Total', value: 'courierBonusJournal.row.total' },
  { group: 'Courier Bonus Journal', label: 'Bonus amount', value: 'courierBonusJournal.row.bonusAmount' },

  // ── Client Monthly Report ─────────────────────────────────────────────────
  { group: 'Client Monthly Report', label: 'Client name', value: 'clientMonthly.clientName' },
  { group: 'Client Monthly Report', label: 'Client legal name', value: 'clientMonthly.clientLegalName' },
  { group: 'Client Monthly Report', label: 'Start date', value: 'clientMonthly.startDate' },
  { group: 'Client Monthly Report', label: 'End date', value: 'clientMonthly.endDate' },
  { group: 'Client Monthly Report', label: 'Performance: service type', value: 'clientMonthly.performance.shortName' },
  { group: 'Client Monthly Report', label: 'Performance: minutes', value: 'clientMonthly.performance.minutes' },
  { group: 'Client Monthly Report', label: 'Performance: count', value: 'clientMonthly.performance.count' },
  { group: 'Client Monthly Report', label: 'Performance: on-time %', value: 'clientMonthly.performance.speedPercent' },
  { group: 'Client Monthly Report', label: 'Performance: avg speed', value: 'clientMonthly.performance.avgSpeed' },
  { group: 'Client Monthly Report', label: 'Performance: late count', value: 'clientMonthly.performance.lateCount' },
  { group: 'Client Monthly Report', label: 'Performance: total mins late', value: 'clientMonthly.performance.totalMinsLate' },
  { group: 'Client Monthly Report', label: 'Performance: success %', value: 'clientMonthly.performance.successPercent' },
  { group: 'Client Monthly Report', label: 'Expenditure: year', value: 'clientMonthly.expenditure.year' },
  { group: 'Client Monthly Report', label: 'Expenditure: month', value: 'clientMonthly.expenditure.month' },
  { group: 'Client Monthly Report', label: 'Expenditure: total jobs', value: 'clientMonthly.expenditure.totalJobs' },
  { group: 'Client Monthly Report', label: 'Expenditure: monthly spend', value: 'clientMonthly.expenditure.monthlyExpenditure' },
  { group: 'Client Monthly Report', label: 'Destination: year', value: 'clientMonthly.destination.year' },
  { group: 'Client Monthly Report', label: 'Destination: month', value: 'clientMonthly.destination.month' },
  { group: 'Client Monthly Report', label: 'Destination: suburb', value: 'clientMonthly.destination.suburb' },
  { group: 'Client Monthly Report', label: 'Destination: total jobs', value: 'clientMonthly.destination.totalJobs' },
  { group: 'Client Monthly Report', label: 'Destination: monthly spend', value: 'clientMonthly.destination.monthlyExpenditure' },
  { group: 'Client Monthly Report', label: 'Job: job number', value: 'clientMonthly.job.jobNumber' },
  { group: 'Client Monthly Report', label: 'Job: job type', value: 'clientMonthly.job.jobType' },
  { group: 'Client Monthly Report', label: 'Job: date', value: 'clientMonthly.job.date' },
  { group: 'Client Monthly Report', label: 'Job: booked', value: 'clientMonthly.job.booked' },
  { group: 'Client Monthly Report', label: 'Job: picked up time', value: 'clientMonthly.job.pickedUpTime' },
  { group: 'Client Monthly Report', label: 'Job: delivered', value: 'clientMonthly.job.delivered' },
  { group: 'Client Monthly Report', label: 'Job: total time (mins)', value: 'clientMonthly.job.totalTime' },
  { group: 'Client Monthly Report', label: 'Job: delivery mins', value: 'clientMonthly.job.deliveryMins' },
  { group: 'Client Monthly Report', label: 'Job: POD name', value: 'clientMonthly.job.podName' },
  { group: 'Client Monthly Report', label: 'Job: booker', value: 'clientMonthly.job.booker' },
  { group: 'Client Monthly Report', label: 'Job: achieved speed', value: 'clientMonthly.job.achievedSpeed' },
  { group: 'Client Monthly Report', label: 'Job: from', value: 'clientMonthly.job.from' },
  { group: 'Client Monthly Report', label: 'Job: from postcode', value: 'clientMonthly.job.fromPostcode' },
  { group: 'Client Monthly Report', label: 'Job: to', value: 'clientMonthly.job.to' },
  { group: 'Client Monthly Report', label: 'Job: to postcode', value: 'clientMonthly.job.toPostcode' },
  { group: 'Client Monthly Report', label: 'Job: address', value: 'clientMonthly.job.address' },
  { group: 'Client Monthly Report', label: 'Job: late pickup (mins)', value: 'clientMonthly.job.latePickup' },
  { group: 'Client Monthly Report', label: 'Job: late delivery (mins)', value: 'clientMonthly.job.lateDelivery' },
  { group: 'Client Monthly Report', label: 'Job: speed', value: 'clientMonthly.job.speed' },
  { group: 'Client Monthly Report', label: 'Job: notes', value: 'clientMonthly.job.notes' },
  { group: 'Client Monthly Report', label: 'Job: charge excl GST', value: 'clientMonthly.job.chargeExclGst' },
  { group: 'Client Monthly Report', label: 'Job: fuel surcharge amount', value: 'clientMonthly.job.fuelSurchargeAmount' },
  { group: 'Client Monthly Report', label: 'Job: ref A', value: 'clientMonthly.job.refA' },
  { group: 'Client Monthly Report', label: 'Job: ref B', value: 'clientMonthly.job.refB' },
  { group: 'Client Monthly Report', label: 'Job: urgent ref', value: 'clientMonthly.job.urgentRef' },
  { group: 'Client Monthly Report', label: 'Job: weight', value: 'clientMonthly.job.weight' },
  { group: 'Client Monthly Report', label: 'Job: vehicle', value: 'clientMonthly.job.vehicle' },
  { group: 'Client Monthly Report', label: 'Job: quantity', value: 'clientMonthly.job.quantity' },
  { group: 'Client Monthly Report', label: 'Job: courier code', value: 'clientMonthly.job.courierCode' },
  { group: 'Client Monthly Report', label: 'Job: courier name', value: 'clientMonthly.job.courierName' },
  { group: 'Client Monthly Report', label: 'Callout: job number', value: 'clientMonthly.callout.jobNumber' },
  { group: 'Client Monthly Report', label: 'Callout: date', value: 'clientMonthly.callout.date' },
  { group: 'Client Monthly Report', label: 'Callout: booked', value: 'clientMonthly.callout.booked' },
  { group: 'Client Monthly Report', label: 'Callout: delivered', value: 'clientMonthly.callout.delivered' },
  { group: 'Client Monthly Report', label: 'Callout: achieved speed', value: 'clientMonthly.callout.achievedSpeed' },
  { group: 'Client Monthly Report', label: 'Callout: from', value: 'clientMonthly.callout.from' },
  { group: 'Client Monthly Report', label: 'Callout: to', value: 'clientMonthly.callout.to' },
  { group: 'Client Monthly Report', label: 'Callout: address', value: 'clientMonthly.callout.address' },
  { group: 'Client Monthly Report', label: 'Callout: courier name', value: 'clientMonthly.callout.courierName' },
  { group: 'Client Monthly Report', label: 'Callout: event type', value: 'clientMonthly.callout.eventType' },
  { group: 'Client Monthly Report', label: 'Callout: notes', value: 'clientMonthly.callout.notes' },
  { group: 'Client Monthly Report', label: 'Callout: charge excl GST', value: 'clientMonthly.callout.chargeExclGst' },

  // ── Ingram Manifest ───────────────────────────────────────────────────────
  { group: 'Ingram Manifest', label: 'Book date', value: 'ingramManifest.bookDate' },
  { group: 'Ingram Manifest', label: 'Book time', value: 'ingramManifest.bookTime' },
  { group: 'Ingram Manifest', label: 'Clear area name', value: 'ingramManifest.page.clearAreaName' },
  { group: 'Ingram Manifest', label: 'Size', value: 'ingramManifest.page.size' },
  { group: 'Ingram Manifest', label: 'Client ref A', value: 'ingramManifest.row.clientRefA' },
  { group: 'Ingram Manifest', label: 'Client ref B', value: 'ingramManifest.row.clientRefB' },
  { group: 'Ingram Manifest', label: 'Job number', value: 'ingramManifest.row.jobNumber' },
  { group: 'Ingram Manifest', label: 'To address', value: 'ingramManifest.row.toAddress' },
  { group: 'Ingram Manifest', label: 'To suburb', value: 'ingramManifest.row.toSuburb' },
  { group: 'Ingram Manifest', label: 'Quantity', value: 'ingramManifest.row.quantity' },
  { group: 'Ingram Manifest', label: 'Weight', value: 'ingramManifest.row.weight' },

  // ── Invoice Builder ───────────────────────────────────────────────────────
  { group: 'Invoice Builder', label: 'Company name', value: 'invoiceBuilder.company_name' },
  { group: 'Invoice Builder', label: 'Company address', value: 'invoiceBuilder.company_address' },
  { group: 'Invoice Builder', label: 'Company phone', value: 'invoiceBuilder.company_phone' },
  { group: 'Invoice Builder', label: 'Company email', value: 'invoiceBuilder.company_email' },
  { group: 'Invoice Builder', label: 'Company website', value: 'invoiceBuilder.company_website' },
  { group: 'Invoice Builder', label: 'Company GST', value: 'invoiceBuilder.company_gst' },
  { group: 'Invoice Builder', label: 'Invoice number', value: 'invoiceBuilder.invoice_number' },
  { group: 'Invoice Builder', label: 'Invoice date', value: 'invoiceBuilder.invoice_date' },
  { group: 'Invoice Builder', label: 'Due date', value: 'invoiceBuilder.due_date' },
  { group: 'Invoice Builder', label: 'Invoice period', value: 'invoiceBuilder.invoice_period' },
  { group: 'Invoice Builder', label: 'Payment terms', value: 'invoiceBuilder.payment_terms' },
  { group: 'Invoice Builder', label: 'PO number', value: 'invoiceBuilder.po_number' },
  { group: 'Invoice Builder', label: 'Client name', value: 'invoiceBuilder.client_name' },
  { group: 'Invoice Builder', label: 'Client contact', value: 'invoiceBuilder.client_contact' },
  { group: 'Invoice Builder', label: 'Client address', value: 'invoiceBuilder.client_address' },
  { group: 'Invoice Builder', label: 'Client phone', value: 'invoiceBuilder.client_phone' },
  { group: 'Invoice Builder', label: 'Client email', value: 'invoiceBuilder.client_email' },
  { group: 'Invoice Builder', label: 'Client account', value: 'invoiceBuilder.client_account' },
  { group: 'Invoice Builder', label: 'Subtotal', value: 'invoiceBuilder.subtotal' },
  { group: 'Invoice Builder', label: 'Fuel surcharge total', value: 'invoiceBuilder.fuel_surcharge_total' },
  { group: 'Invoice Builder', label: 'GST amount', value: 'invoiceBuilder.gst_amount' },
  { group: 'Invoice Builder', label: 'Total', value: 'invoiceBuilder.total' },
  { group: 'Invoice Builder', label: 'Amount paid', value: 'invoiceBuilder.amount_paid' },
  { group: 'Invoice Builder', label: 'Balance due', value: 'invoiceBuilder.balance_due' },
  { group: 'Invoice Builder', label: 'Statement: date', value: 'invoiceBuilder.statement.date' },
  { group: 'Invoice Builder', label: 'Statement: description', value: 'invoiceBuilder.statement.description' },
  { group: 'Invoice Builder', label: 'Statement: reference', value: 'invoiceBuilder.statement.reference' },
  { group: 'Invoice Builder', label: 'Statement: amount', value: 'invoiceBuilder.statement.amount' },
  { group: 'Invoice Builder', label: 'Statement: balance', value: 'invoiceBuilder.statement.balance' },

  // ── Delivery Alert OTG (air cargo) ────────────────────────────────────────
  { group: 'Delivery Alert OTG', label: 'Job number', value: 'deliveryAlertOtg.jobNumber' },
  { group: 'Delivery Alert OTG', label: 'Pickup date', value: 'deliveryAlertOtg.pickupDate' },
  { group: 'Delivery Alert OTG', label: 'Flight no', value: 'deliveryAlertOtg.flightNo' },
  { group: 'Delivery Alert OTG', label: 'Con note', value: 'deliveryAlertOtg.conNote' },
  { group: 'Delivery Alert OTG', label: 'Gate number', value: 'deliveryAlertOtg.gateNumber' },
  { group: 'Delivery Alert OTG', label: 'ETA time', value: 'deliveryAlertOtg.etaTime' },
  { group: 'Delivery Alert OTG', label: 'Destination airport code', value: 'deliveryAlertOtg.destinationAirportCode' },
  { group: 'Delivery Alert OTG', label: 'Destination airport name', value: 'deliveryAlertOtg.destinationAirportName' },
  { group: 'Delivery Alert OTG', label: 'Origin airport code', value: 'deliveryAlertOtg.originAirportCode' },
  { group: 'Delivery Alert OTG', label: 'Destination agent name', value: 'deliveryAlertOtg.destinationAgentName' },
  { group: 'Delivery Alert OTG', label: 'Destination agent phone', value: 'deliveryAlertOtg.destinationAgentPhone' },
  { group: 'Delivery Alert OTG', label: 'Destination agent email', value: 'deliveryAlertOtg.destinationAgentEmail' },
  { group: 'Delivery Alert OTG', label: 'Pickup time', value: 'deliveryAlertOtg.pickUpTime' },
  { group: 'Delivery Alert OTG', label: 'Weight', value: 'deliveryAlertOtg.weight' },
  { group: 'Delivery Alert OTG', label: 'Quantity', value: 'deliveryAlertOtg.quantity' },
  { group: 'Delivery Alert OTG', label: 'Pickup address line 1', value: 'deliveryAlertOtg.pickupAddressLine1' },
  { group: 'Delivery Alert OTG', label: 'Pickup address line 2', value: 'deliveryAlertOtg.pickupAddressLine2' },
  { group: 'Delivery Alert OTG', label: 'Pickup address line 3', value: 'deliveryAlertOtg.pickupAddressLine3' },
  { group: 'Delivery Alert OTG', label: 'Pickup address line 4', value: 'deliveryAlertOtg.pickupAddressLine4' },
  { group: 'Delivery Alert OTG', label: 'Pickup address line 5', value: 'deliveryAlertOtg.pickupAddressLine5' },
  { group: 'Delivery Alert OTG', label: 'Pickup address line 6', value: 'deliveryAlertOtg.pickupAddressLine6' },
  { group: 'Delivery Alert OTG', label: 'Pickup address line 7', value: 'deliveryAlertOtg.pickupAddressLine7' },
  { group: 'Delivery Alert OTG', label: 'Pickup from contact', value: 'deliveryAlertOtg.pickupFromContact' },
  { group: 'Delivery Alert OTG', label: 'Pickup from phone', value: 'deliveryAlertOtg.pickupFromPhone' },
  { group: 'Delivery Alert OTG', label: 'Delivery address line 1', value: 'deliveryAlertOtg.deliveryAddressLine1' },
  { group: 'Delivery Alert OTG', label: 'Delivery address line 2', value: 'deliveryAlertOtg.deliveryAddressLine2' },
  { group: 'Delivery Alert OTG', label: 'Delivery address line 3', value: 'deliveryAlertOtg.deliveryAddressLine3' },
  { group: 'Delivery Alert OTG', label: 'Delivery address line 4', value: 'deliveryAlertOtg.deliveryAddressLine4' },
  { group: 'Delivery Alert OTG', label: 'Delivery address line 5', value: 'deliveryAlertOtg.deliveryAddressLine5' },
  { group: 'Delivery Alert OTG', label: 'Delivery address line 6', value: 'deliveryAlertOtg.deliveryAddressLine6' },
  { group: 'Delivery Alert OTG', label: 'Delivery address line 7', value: 'deliveryAlertOtg.deliveryAddressLine7' },
  { group: 'Delivery Alert OTG', label: 'Deliver to contact', value: 'deliveryAlertOtg.deliverToContact' },
  { group: 'Delivery Alert OTG', label: 'Deliver to phone', value: 'deliveryAlertOtg.deliverToPhone' },
  { group: 'Delivery Alert OTG', label: 'Deliver to address', value: 'deliveryAlertOtg.deliverToAddress' },
  { group: 'Delivery Alert OTG', label: 'Deliver to time', value: 'deliveryAlertOtg.deliverToTime' },
  { group: 'Delivery Alert OTG', label: 'Deliver by time', value: 'deliveryAlertOtg.deliverByTime' },
  { group: 'Delivery Alert OTG', label: 'Notes', value: 'deliveryAlertOtg.notes' },

  // ── Alert Label (token template) ──────────────────────────────────────────
  { group: 'Alert Label', label: 'Page size name', value: 'alertLabel.pageSizeName' },
  { group: 'Alert Label', label: 'Cell type', value: 'alertLabel.cell.cellType' },
  { group: 'Alert Label', label: 'Cell row number', value: 'alertLabel.cell.rowNumber' },
  { group: 'Alert Label', label: 'Cell column number', value: 'alertLabel.cell.columnNumber' },
  { group: 'Alert Label', label: 'Cell value', value: 'alertLabel.cell.value' },
  { group: 'Alert Label', label: 'Cell render type', value: 'alertLabel.cell.renderType' },
  { group: 'Alert Label', label: 'Cell font family', value: 'alertLabel.cell.fontFamily' },
  { group: 'Alert Label', label: 'Cell font size', value: 'alertLabel.cell.fontSize' },
  { group: 'Alert Label', label: 'Cell font weight', value: 'alertLabel.cell.fontWeight' },
  { group: 'Alert Label', label: 'Cell font style', value: 'alertLabel.cell.fontStyle' },
  { group: 'Alert Label', label: 'Cell text decoration', value: 'alertLabel.cell.textDecoration' },
  { group: 'Alert Label', label: 'Cell text align', value: 'alertLabel.cell.textAlign' },
  { group: 'Alert Label', label: 'Cell color', value: 'alertLabel.cell.color' },

  // ── Tenant Branding (shared across all reports) ───────────────────────────
  { group: 'Tenant Branding', label: 'Company name', value: 'branding.companyName' },
  { group: 'Tenant Branding', label: 'Address lines', value: 'branding.addressLines' },
  { group: 'Tenant Branding', label: 'Country', value: 'branding.country' },
  { group: 'Tenant Branding', label: 'Phone', value: 'branding.phone' },
  { group: 'Tenant Branding', label: 'Email', value: 'branding.email' },
  { group: 'Tenant Branding', label: 'Website', value: 'branding.website' },
  { group: 'Tenant Branding', label: 'Logo URL', value: 'branding.logoUrl' },
  { group: 'Tenant Branding', label: 'Primary colour', value: 'branding.primaryColour' },
  { group: 'Tenant Branding', label: 'Header text colour', value: 'branding.headerTextColour' },
  { group: 'Tenant Branding', label: 'Accent colour', value: 'branding.accentColour' },
  { group: 'Tenant Branding', label: 'Footer text', value: 'branding.footerText' },
  { group: 'Tenant Branding', label: 'Disclaimer text', value: 'branding.disclaimerText' },
  { group: 'Tenant Branding', label: 'Paper size', value: 'branding.paperSize' },
  { group: 'Tenant Branding', label: 'Time zone ID', value: 'branding.timeZoneId' },
  { group: 'Tenant Branding', label: 'Country code', value: 'branding.countryCode' },
];

// ── Proof of Delivery — Item table rows (fixed indexed slots) ─────────────────
// A coordinate overlay stamps one value per fixed position, so item tables use indexed slots: place a
// field per cell and bind it to `pod.item.<row>.<field>`. The server fills rows in job-item order up to
// ITEM_ROW_SLOTS; a job with more items overflows (extra rows are not stamped). NB: tucJobItems has no
// separate width column — Depth is the third linear dimension. Item code / type names live on the item
// *type* (a many-per-item relationship) and aren't flattened into a physical-item row here.
const ITEM_ROW_SLOTS = 20;
const ITEM_ROW_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'quantity', label: 'Qty' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'notes', label: 'Notes' },
  { key: 'weight', label: 'Weight' },
  { key: 'length', label: 'Length' },
  { key: 'height', label: 'Height' },
  { key: 'depth', label: 'Depth (width)' },
  { key: 'cubic', label: 'Cubic' },
];

const itemRowBindings: readonly DataBinding[] = Array.from({ length: ITEM_ROW_SLOTS }, (_, i) => i).flatMap((i) =>
  ITEM_ROW_FIELDS.map((f) => ({
    group: 'Proof of Delivery — Item rows',
    label: `Item ${i + 1} · ${f.label}`,
    value: `pod.item.${i}.${f.key}`,
  })),
);

export const dataBindingGroups: readonly DataBinding[] = [...baseBindings, ...itemRowBindings];

/** Flat list of binding paths (back-compat; free-text is also allowed). */
export const dataBindings: readonly string[] = dataBindingGroups.map((b) => b.value);

// Path segments that denote a per-record collection (line items, job rows, manifest cells, …).
const REPEATING_SEGMENTS = new Set([
  'row', 'line', 'cell', 'page', 'statement',
  'job', 'callout', 'performance', 'expenditure', 'destination', 'speed',
]);

// Reports whose every field is a per-row value (no header-level singletons to stamp).
const REPEATING_GROUPS = new Set([
  'Courier Job Summary (Management)',
  'Courier Fleet Job Summary',
]);

/**
 * True when a binding comes from a repeating collection. A coordinate overlay stamps a single value per
 * field, so these can't be placed meaningfully (only one record would ever render) — the picker flags them.
 */
export function isRepeatingBinding(value: string, group?: string): boolean {
  if (group && REPEATING_GROUPS.has(group)) {
    return true;
  }
  return value.split('.').some((segment) => REPEATING_SEGMENTS.has(segment));
}
