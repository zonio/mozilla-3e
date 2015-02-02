
function cal3eEventSummary() {
  var eventSummaryDialog = this;

  function createListBox(attachments) {
    var listBox = document.createElement('listbox');
    listBox.setAttribute('flex', '1');
    listBox.setAttribute('rows', '3');

    attachments.forEach(function(attachment) {
      var listItem = document.createElement('listitem');
      listItem.value = attachment.uri.spec;

      var splittedUri = attachment.uri.spec.split('/');
      listItem.setAttribute('label',
        decodeURIComponent(splittedUri[splittedUri.length - 1]));

      listBox.appendChild(listItem);
    });

    return listBox;
  }

  function createAttachmentsInnerBox(attachments) {
    var innerBox = document.createElement('box');
    innerBox.setAttribute('orient', 'horizontal');
    innerBox.appendChild(createSpacer());
    innerBox.appendChild(createListBox(attachments));

    return innerBox;
  }

  function createCalendarCaption(label) {
    var calendarCaption = document.createElement('calendar-caption');
    calendarCaption.setAttribute('label', label);
    calendarCaption.setAttribute('align', 'center');

    return calendarCaption;
  }

  function createSpacer() {
    var spacer = document.createElement('spacer');
    spacer.setAttribute('class', 'default-spacer');

    return spacer;
  }

  function createAttachmentsBox(attachments) {
    var box = document.createElement('box');
    box.setAttribute('id', 'item-attachments');
    box.setAttribute('orient', 'vertical');

    box.appendChild(createSpacer());
    box.appendChild(createCalendarCaption('Attachments'));
    box.appendChild(createAttachmentsInnerBox(attachments));

    return box;
  }

  function showAttachments(attachments) {
    document.getElementById('calendar-event-summary-dialog')
      .appendChild(createAttachmentsBox(attachments));
  }

  eventSummaryDialog.showAttachments = showAttachments;
}

cal3eEventSummary.onLoad = function cal3eSubscription_onLoad() {
  var args = window.arguments[0];
  var event = args.calendarEvent.clone();
  var controller = new cal3eEventSummary();
  var attachments = event.getAttachments({});

  if (attachments.length > 0) {
    controller.showAttachments(attachments);
  }
}

window.addEventListener('load', cal3eEventSummary.onLoad, false);
