var Dashboard = (function ($) {

    var module = {};

    var data = {};
    var transposedData = {};
    var div = "";
    var chartTypes = [];

    // delete quotes and replace punctuation to spaces
    module.formatString = function(str) {
      if(str[0] == '"' && str[0] == str[str.length - 1]) {
        str = str.substring(1, str.length - 1);
      }
      return str.replace(/([a-zA-Z]+)[.]([a-zA-Z]+)/g, "$1 $2");
    };

    module.init = function(inputData, types) {
      // TIME_KEEPING
      // console.log("--- Dashboard Script Starts Loading ---");
      // window.ST = (new Date());
      // console.log("Dashboard init: " + 0);

      chartTypes = types;
      module.reset();
      return module.initWithType(inputData, module.identifyType(inputData));

      // TIME_KEEPING
      // console.log("Dashboard init: " + ((new Date())-window.ST));
      // console.log("--- Dashboard Script Ends Loading ---");
    };

    module.initWithType = function(inputData, type) {
      switch(type) {
      case "csv":
        return module.readCsvData(inputData);
      case "arff":
        return module.readArffData(inputData);
      default:
        console.log("Error document type!");
        return false;
      }
    };

    module.identifyType = function(inputData) {
      function isArffData(data) {
        if (!data.match(/@relation/i)) {
          return false;
        }
        if (!data.match(/@attribute/i)) {
          return false;
        }
        if (!data.match(/@data/i)) {
          return false;
        }
        return true;
      }

      if(isArffData(inputData)) return "arff";
      else return "csv";
    };

    module.readCsvData = function(csvString) {
      // TIME_KEEPING
      // console.log("Dashboard read data #1: " + ((new Date())-window.ST));

      // @brief decide if parsing returns deadly result
      // @param error   error generated by csv parser
      // @return if the error is ok (can continue), return true
      //          otherwise return false (process will terminate)
      function parseErrorIsOk(error) {
        return (error.length == 0 || 
        (error.length == 1 && error[0].code == "UndetectableDelimiter"));
      }

      // @brief check if the first row is header
      //        Criteria: if all row items in the 1st and 2nd rows are same
      //            then return true
      // 
      // @param previewRows first ten rows of the data for preview
      function hasHeader (previewRows) {
        var headerArray = previewRows[0];
        var secondRow = previewRows[1];

        for(var ix = 0; ix < headerArray.length; ix++) {
          var mappedData = previewRows.map(function(val) {
            return val[ix];
          });

          var matches = mappedData.filter(function(val) {
            return val == headerArray[ix];
          });

          if(isNaN(headerArray[ix]) != isNaN(secondRow[ix])) {
            return true;
          }
          else if(isNaN(headerArray[ix]) && matches.length == 1) {
            return true;
          }
        }
        return false;
      }

      // @brief delete index column if there is one
      //        Criteria: first columns of the first 10 rows are 1-10
      // @param csvRows       csv string separated to an array of rows
      // @param previewRows   first 10 rows of the dataset
      // @param delimiter     delimiter of the csv string
      // @param linebreak     linebreak of the csv string
      // @return  if there is index column, the function returns the edited csv string
      //          in other cases, the function returns null
      function deleteIndexColumn (csvRows, previewRows, delimiter, linebreak) {
        var willDeleteIndexColumn = true;
        previewRows.forEach(function(row, ix) {
          if(isNaN(row[0]) || parseInt(row[0]) != ix + 1) {
            willDeleteIndexColumn = false;
          }
        });
        if(willDeleteIndexColumn) {
          return csvRows.map(function(row) {
            return row.substring(row.indexOf(delimiter) + 1);
          }).join(linebreak);
        }
        return null;
      }

      // trial round: try parsing to guess delimiter and linebreak
      var previewResults = Papa.parse(csvString, {
        header: false,
        dynamicTyping: true,
        preview: 10,
        skipEmptyLines: true
      });

      // if parse result if not ok, then terminate and return
      if(!parseErrorIsOk(previewResults.errors)) {
        module.handleError(previewResults.errors[0].message);
        return false;
      }

      // TIME_KEEPING
      // console.log("Dashboard read data preview end #2: " + ((new Date())-window.ST));

      // get delimiter and line break from preview parse result
      var delimiter = previewResults.meta.delimiter;
      var linebreak = previewResults.meta.linebreak;

      // check if the csv string represent a dataset with header row
      // note that csv header need not be right at this time
      var rowSplitRegex = new RegExp("[^" + linebreak + "]+", "g");
      var csvRows = csvString.match(rowSplitRegex) || [];
      var csvHeader = csvRows[0].split(delimiter);
      if(csvRows.length <= 1) {
        module.handleError("Data must have at least 2 rows.");
        return false;
      }
      var previewRows = previewResults.data;
      var csvHasHeader = hasHeader(previewRows);
      if(csvHasHeader && csvRows.length == 2) {
        module.handleError("Data must have at least 2 rows.");
        return false;
      }

      if(csvHasHeader) {
        // if csv has header, then update header and string data
        previewRows = previewRows.splice(1);
        csvString = csvString.substring(csvString.indexOf(linebreak) + 1);
        csvHeader = csvHeader.map(module.formatString);
        csvRows.splice(0, 1);

        // if the first column index is empty, then add one named "index"
        // this "index" means the column represents data point name but is not number index
        if(previewResults.data[0][0].trim() == "") {
          csvHeader[0] = "Index";
        }
      }

      // delete index column if there is one
      var csvStringWithoutIndexColumn = deleteIndexColumn(csvRows, previewRows, delimiter, linebreak);
      if(csvStringWithoutIndexColumn != null) {
        csvString = csvStringWithoutIndexColumn;
        csvHeader.splice(0, 1);
      }

      // this cannot be written as an else statement to immediately follow if
      // because then column 1 might be deleted, leaving column index to start with 2
      if(!csvHasHeader) {
        // if csv doesn't have header, then add one to the csv string
        csvHeader = csvHeader.map(function(item, ix) {
          return "Column " + (ix + 1);
        });
      }

      // join header and row contents
      csvString = csvHeader.join(delimiter) + linebreak + csvString;

      // TIME_KEEPING
      // console.log("Dashboard read data parsing start #3: " + ((new Date())-window.ST));

      // generate entire parse result
      var parseResults = Papa.parse(csvString, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      csvHeader = Object.keys(parseResults.data[0]);

      if(!parseErrorIsOk(parseResults.errors)) {
        module.handleError(parseResults.errors[0].message);
        return false;
      }

      // set module's data member
      data['data'] = parseResults.data;
      data['attribute'] = [];

      // TIME_KEEPING
      // console.log("Dashboard read data parsing end #4: " + ((new Date())-window.ST));

      // set attribute types
      for(colIndex = 0; colIndex < csvHeader.length; colIndex++) {
        // view index as string and not include it in data analysis
        if(colIndex == 0 && csvHeader[0] == 'Index') {
          data['attribute'].push({
            "name": csvHeader[colIndex],
            "type": {
              "type": "string"
            }
          });
        }

        // identify numeric column
        else if(typeof data['data'][0][csvHeader[colIndex]] === 'number') {

          // count unique elements
          // Code source: https://stackoverflow.com/questions/21661686/fastest-way-to-get-count-of-unique-elements-in-javascript-array
          var uniqueElements = data['data'].reduce(function(values, item) {
            var v = item[csvHeader[colIndex]];
            if (!values.set[v]) {
              values.set[v] = 1;
              values.arr.push(v);
            }
            return values;
          }, { set: {}, arr: []});

          var countNonIntegers = uniqueElements.arr.filter(function(val) { Math.floor(val) != val; }).length;
          if(uniqueElements.arr.length <= 10 && countNonIntegers == 0) {
            data['attribute'].push({
              "name": csvHeader[colIndex],
              "type": {
                "type": "discrete",
                "oneof": uniqueElements.arr
              }
            });
          }
          else {
            data['attribute'].push({
              "name": csvHeader[colIndex],
              "type": {
                "type": "numeric"
              }
            });
          }
        }

        // in other cases, check whether string represents nominal data
        else {
          // count unique elements
          // Code source: https://stackoverflow.com/questions/21661686/fastest-way-to-get-count-of-unique-elements-in-javascript-array
          var uniqueElements = data['data'].reduce(function(values, item) {
            var v = item[csvHeader[colIndex]];
            if (!values.set[v]) {
              values.set[v] = 1;
              values.count++;
            }
            return values;
          }, { set: {}, count: 0 });

          if(uniqueElements.count <= 10) {
            data['attribute'].push({
              "name": csvHeader[colIndex],
              "type": {
                "type": "nominal",
                "oneof": Object.keys(uniqueElements.set)
              }
            });
          }
          else {
            data['attribute'].push({
              "name": csvHeader[colIndex],
              "type": {
                "type": "string"
              }
            });
          }
        }
      }

      // TIME_KEEPING
      // console.log("Dashboard read data end #5: " + ((new Date())-window.ST));

      // for debug: print the parsed data
      // console.log(data);

      return true;
    };

    module.readArffData = function(csvString) {
      // TIME_KEEPING
      // console.log("Dashboard read data #1: " + ((new Date())-window.ST));

      var section;
      var parsed = { 'relation': [], 'attribute': [], 'data': [] };

      function readLine(line) {
          if (!section) section = 'header';

          var chunks = line.trim().split(/[\s]+/);

          // skip blank lines and comments
          if (chunks.length === 1 && chunks[0] === '') return true;
          else if (/^%/.test(chunks[0])) {
            return true;
          }

          // relation name
          else if (/^@RELATION/i.test(chunks[0])) {
            if (section !== 'header') {
              module.handleError('@RELATION found outside of header');
              return false;
            }
            parsed['relation'].push(chunks[1]);
          }

          // attribute spec
          else if (/^@ATTRIBUTE/i.test(chunks[0])) {
            if (section != 'header') {
              module.handleError('@ATTRIBUTE found outside of header section');
              return false;
            }
            var name = chunks[1].replace(/['"]|:$/g, '');
            var type = parseAttributeType(chunks.slice(2).join(' '));
            parsed['attribute'].push({ "name": module.formatString(name), "type": type });
          }

          else if (/^@DATA/i.test(chunks[0])) {
            if (section == 'data') {
              module.handleError('@DATA found after DATA');
              return false;
            }
            section = 'data';
          }
          else {
            if (section == 'data') {
              var dataRow = chunks.join('').replace(/['"]/g, '').split(',');
              var parsedRow = {};
              for(var ix = 0; ix < dataRow.length; ix++) {
                var entryName = parsed["attribute"][ix]["name"];
                if(parsed["attribute"][ix]["type"]["type"] == "numeric") {
                  parsedRow["" + entryName] = parseFloat(dataRow[ix]);
                }
                else {
                  parsedRow["" + entryName] = dataRow[ix];
                }
              }
              parsed['data'].push(parsedRow);
            }
          }
          return true;
      }

      function parseAttributeType(type) {
        var finaltype = { "type": type };
        var parts;

        if (/^date/i.test(type)) {
          parts = type.split(/[\s]+/);
          var format = "yyyy-MM-dd'T'HH:mm:ss";
          if (parts.length > 1) {
            format = parts[1];
          }
          finaltype = {
            "type": 'date',
            "format": format
          }
        }
        else if (parts = type.match(/^{([^}]*)}$/)) {
          finaltype["type"] = 'nominal';
          finaltype["oneof"] = parts[1].replace(/[\s'"]/g, '').split(/,/);
        }
        else if (/^numeric|^integer|^real|^continuous/i.test(type)) {
          finaltype["type"] = 'numeric';
        }
        else if (/string/i.test(type)) {
          finaltype["type"] = 'string';
        }

        return finaltype;
      }

      var lines = csvString.match(/[^\r\n]+/g);

      for(lineIndex in lines) {
          if((lines[lineIndex].replace(/\s/g,''))[0] == '%') continue;
          if(readLine(lines[lineIndex]) == false) return false;
      }

      // TIME_KEEPING
      // console.log("Dashboard read data end #5: " + ((new Date())-window.ST));

      // for debug: log parsed data
      // console.log(parsed);

      data = parsed;

      return true;
    };

    // @brief error handler for the parsing process
    //        shows the error and resets progress
    // @param errMsg  error message to be shown in the error message modal
    module.handleError = function(errMsg) {
      $(".ui.look.button").addClass("disabled");
      var $errmsg = $(".errmsg.modal");
      $errmsg.find('.description').text(errMsg);
      $errmsg.modal('settings', {
        closable  : false
      }).modal('show');
      module.progress.set(-1);
      module.reset();    
      $(".header-dropdown").dropdown('restore defaults');
    };

    // @brief initialize all graph drawing modules
    // @param divCode   the div selector name where graph drawing modules reside
    module.draw = function(divCode = ".graph-content", transpose = false) {
      div = divCode;

      for(ix in chartTypes) {
        var funcName = chartTypes[ix];
        $(div + ' .column.' + funcName + ':not(.hoarded)').each(function() {
          if(transpose) {
            $(this)["dashboard_" + funcName](transposedData);
          }
          else {
            $(this)["dashboard_" + funcName](data);
          }
        });
      }
    };

    // @brief draw a single module only
    // @param divCode         the div selector name where graph drawing modules reside
    // @param moduleTypeCode  the identifier of the module type
    module.drawModule = function(divCode, moduleTypeCode) {
      console.log(divCode.html());
      $(divCode)["dashboard_" + moduleTypeCode](data);
    };

    // @brief variable to deal with visualizing loading indicator
    //        progress = 0 : loading starts, old graphs are hidden and indicator starts
    //        progress = 1 : downloading finishes, data parsing starts
    //        progress = 2 : parsing ends, module initialization starts
    //        progress = 3 : all work done, indicator is hidden and graphs are shown
    //        progress = -1 : bad things happened. Reset everything. Error message is handled elsewhere.
    module.progress = (function() {
      var progress = 0;
      var text = "";
      return {
        set: function(val) {
          progress = val;

          if(val == 0) {
            $(".graphs").addClass("hidden");
            $(".graphs + .ui.dimmer").addClass("active");
            $(".header-dropdown").addClass("disabled");
            $(".look.button").addClass("disabled");
            $(".downloading.button").addClass("disabled");
            text = "Downloading File";
          }
          else if(val == 1) {
            text = "Parsing Data";
          }
          else if(val == 2) {
            text = "Loading Visualizations";
          }
          else if(val == 3) {
            $(".graphs + .ui.dimmer").removeClass("active");
            $(".graphs").removeClass("hidden");
            $(".header-dropdown").removeClass("disabled");
            $(".look.button").removeClass("disabled");
          }
          else {
            $(".graphs").removeClass("hidden");
            $(".graphs + .ui.dimmer").removeClass("active");
            $(".header-dropdown").removeClass("disabled");
            $(".look.button").removeClass("disabled");
            progress = 0;
            text = "";
          }
          $(".graphs + .ui.dimmer > .text.loader").text(text);
        },
        get: function() {
          return progress;
        }
      };
    }());

    // @brief get data currently stored in the module
    module.getColumns = function(type = "") {
      return data["attribute"].filter(function(val) {
        return type == "" || val["type"]["type"] == type;
      }).map(function(val) {
        return val["name"];
      });
    };

    // @brief transpose dataset and display visualizations for the processed data
    // @param titleColumn column to be used as new column titles
    // @param dataType    data types of the rows
    // @param rows        row names
    module.setTransposeData = function(titleColumn, dataType, rows) {
      transposedData = {};
      var columnNames = data["data"].map(function(dataRow) {
        return dataRow[titleColumn];
      });
      transposedData.data = rows.map(function(rowName, ix) {
        var row = {};
        row["Index"] = rowName;
        data["data"].forEach(function(originalRow) {
          row[originalRow[titleColumn]] = originalRow[rows[ix]];
        });
        return row;
      });
      transposedData.attribute = columnNames.map(function(columnName) {
        var thisAttribute = {
          name: columnName,
          type: {
            type: dataType
          }
        };
        if(dataType == "nominal") {
          thisAttribute.type.oneof = new Set(transposedData.data.map(function(row) {
            return row[columnName];
          })).values();
        }
        return thisAttribute;
      });
      (function() {
        return new Promise(function(resolve, reject) {
          $(".transpose.modal .primary.button").addClass("loading");
          setTimeout(function() {
            module.draw(div, true);
            resolve();
          }, 1);
        });
      })().then(function() {
        $(".transpose.modal .primary.button").removeClass("loading");
        $(".transpose.modal").modal("hide");
      });
    };

    // @brief get currently rendered data in table format
    module.getDataTable = function() {
      // TIME_KEEPING
      window.ST = (new Date());
      console.log("Get Table Starts: " + 0);

      var table = $('<table></table>');
      var thead = $('<thead></thead>').append($('<tr></tr>').append(
        data["attribute"].map(function(attr) {
          return "<th>" + attr["name"] + "</th>";
        }).join("")
      ));
      table.append(thead);
      var tbody = $('<tbody></tbody>').append(
        data["data"].map(function(row) {
          return "<tr>" + Object.keys(row).map(function(name) {
            return "<td>" + row[name] + "</td>"
          }).join("") + "</tr>";
        }).join("")
      );
      table.append(tbody);

      // TIME_KEEPING
      console.log("Get Table Ends: " + ((new Date())-window.ST));
      return table;
    };

    // @brief reset the module, which includes reseting and hiding all submodules
    module.reset = function() {
      data = {};

      /* hide all graphs */
      $(".graph-content > .column").addClass("hidden");

      /* reset all graphs */
      for(ix in chartTypes) {
        var funcName = chartTypes[ix];
        $(div + ' .column.' + funcName).each(function() {
          $(this)["dashboard_" + funcName]("reset");
        });
      }
    };

    return module;

}(jQuery));
