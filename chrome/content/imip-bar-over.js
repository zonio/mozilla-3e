
dump('ltnImipBar: ' + ltnImipBar + '\n');
dump('imip-bar-over.js called\n');

var ImipBarOver = {
  accept: function() {
    dump('ImipBarOver.accept\n');

    var items = ltnImipBar.itipItem.getItemList({});
    dump('items.length: ' + items.length + '\n');
    var item = items[0];
    dump('items: ' + items + '\n');
    item.setProperty('COMMENT', 'Hey, hey, hey!');

    ltnImipBar.executeAction('ACCEPTED');
  },

  update: function() {
    dump('ImipBarOver.update\n');
    var bar = document.getElementById('imip-bar');
    dump('imip-bar: ' + bar + '\n');

    var button = document.getElementById('imip-button1');
    dump('button: ' + button + '\n');
    dump('button.label: ' + button.label + '\n');
    button.label = "Hey, hey";
    button.oncommand = 'cal3e_imip_bar_over();';
    button.setAttribute('oncommand', 'ImipBarOver.accept();');
    dump('button.label: ' + button.label + '\n');

    dump('\n');
  },

  observe: function(subject, topic, state) {
    if (topic === 'onItipItemCreation') {
      dump('observed onItipItemCreation\n');
      setTimeout(this.update, 3000);
    }
  }
};

ImipBarOver.unload = function() {
  dump('ImipBarOver.unload\n');
  removeEventListener("messagepane-loaded", after_imipbar_load);
  removeEventListener("messagepane-unloaded", ImipBarOver.unload);
}

var cal3e_imip_bar_over = function() {
  dump('cal3e_imip_bar_over\n');
  //var items = ltnImipBar.itipItem.getItemList({});
  //dump('items.length: ' + items.length + '\n');
  //var item = items[0];
  //ltnImipBar.executeAction('ACCEPTED');
}

ImipBarOver.load = function() {
  dump('ImipBarOver.load\n');
  Services.obs.addObserver(ImipBarOver, "onItipItemCreation", false);
  //bar_test();
}

//setTimeout(function() {
//  bar_test();
//}, 5000);

addEventListener("messagepane-loaded", ImipBarOver.load, true);
addEventListener("messagepane-unloaded", ImipBarOver.unload, true);
