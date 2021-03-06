(function($) {

	function Univariate(renderTo, dataCopy) {
	
		/* Private Variables */
		var module = this,
			$div,
			$colDropdown,
			$plotDropdown,
			data = [],
			plotTypes = [];

		/* Helper Functions */

		// @brief	converts display string to strings used as div names
		// @param	str 	input string
		// @return 	converted string
		var displayToEncoding = function(str) {
			return str.toLowerCase().replace(/\s+/g, '-');
		};

		// @brief	converts div string names to display string
		// @param	str 	input string
		// @return	converted string
		var encodingToDisplay = function(str) {
			return str.replace(/\w\S*/g, function(txt) {
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
			});
		};

		// @brief	converts column type name to a format easier to work with
		// @param	type 	name of a column type
		// @return	converted column type
		var getType = function(type) {
			if(type === undefined || type == null) {
				return null;
			}
			else if(type["type"] == "numeric" || type["type"] == "nominal") {
				return type["type"];
			}
			else if(type["type"] == "discrete") {
				return "nominal";
			}
			else {
				return "others";
			}
		};

		/* Member Functions */

		// @brief	initialization code
		// @param	renderTo	the jQuery div object 
		//						that the module is rendered to
		// @param	dataCopy	the data used in the visualization 
		//						(data is shallow copied)
		module.init = function(renderTo, dataCopy) {
			$div = renderTo;
			$div.data("module-data", module);
			data = dataCopy;

			module.reset();
			
			$colDropdown = $div.find(".ui.settings.popup").find(".col-dropdown").find(".fluid.dropdown");
			$plotDropdown = $div.find(".ui.settings.popup").find(".plot-dropdown").find(".fluid.dropdown");
			module.initPlotTypes();

			var firstAvailableIx = module.initGraphOptionDropdown();

			if(firstAvailableIx != null) {
				// init popup
				$div.find(".right.floated.meta").find(".link.icon").popup({
					popup: $div.find(".ui.settings.popup"),
					on: "click",
					position: "bottom right",
					variation: "wide"
				});

				// define dropdown action events
				$colDropdown.dropdown("setting", "onChange", function() {
					module.render();
					module.updateDescription();
				});

				$colDropdown.dropdown("set selected", firstAvailableIx);

				module.render();

				$div.removeClass("hidden");
			}
			else {
				console.log("No univariate graph to show");
				$div.addClass("hidden");
			}
		};

		// @brief	extract plot types from html and add click event handlers
		module.initPlotTypes = function() {
			$plotDropdown.find("option").each(function() {
				plotTypes.push($(this).attr("value"));
			});
			$plotDropdown.dropdown("setting", "onChange", function(value) {
				module.updatePlotVisibility(value);
				module.updateDescription();
			});
			$plotDropdown = $div.find(".ui.settings.popup").find(".plot-dropdown").find(".fluid.dropdown");
		};

		module.updatePlotVisibility = function(value) {
			plotTypes.forEach(function(type) {
				$div.find(".plot.wrapper").find("." + type).addClass("hidden");
				$div.find(".settings.popup .plot.options").find("." + type).addClass("hidden");
			});
			$div.find(".plot.wrapper").find("." + value).removeClass("hidden");
			$div.find(".settings.popup .plot.options").find("." + value).removeClass("hidden");
		};

		// @brief	populate graph option dropdown based on column data types
		// @return	first column index that is shown in the dropdown
		module.initGraphOptionDropdown = function() {
			var columnOptions = "";
			var firstAvailableIx = null;
			var columns = [];
			data.forEach(function(singleData) {
				singleData["attribute"].forEach(function(singleAttr) {
					var type = singleAttr["type"];
					if(type != "others") {
						columns.push(singleAttr["name"]);
					}
				});
			});
			var uniqueColumns = Array.from(new Set(columns));
			uniqueColumns.forEach(function(name) {
				var columnType = getType({type: window.getTypeOfColumn(data, name)});
				if(columnType == "others") return;

				if(firstAvailableIx == null) firstAvailableIx = name;

				// populate column selection dropdown
				$colDropdown.find(".menu").append(
					$("<div>").addClass("item").attr("data-value", name)
						.append($("<span>").addClass("right floated").css("color", "gray").text(window.getTypeOfColumn(data, name)))
						.append($("<span>").addClass("text").text(name))
				);
			});
			$colDropdown = $colDropdown.dropdown();
			return firstAvailableIx;
		};

		// @brief	delete bad data in a numeric data column
		//			add bad data notice in the module
		// @param	columnData	the column data to be trimmed
		// @param	type 		data type of the column
		// @return	trimmed column data
		module.trimBadData = function(columnData, type) {
			var $missingNotice = $div.find(".missing.notice");

			if(type != "numeric") {
				$missingNotice.addClass("hidden");
			}

			else {
				$missingNotice.html("<div class='ui " + numberToEnglish(columnData.length) + " column grid'></div>");

				var showing = false;
				columnData.forEach(function(_, ix) {
					if(columnData[ix] == null) {
						$missingNotice.find(".grid").append(
							"<div class='column'> <i class='warning circle icon'></i> No Data </div>"
						);
						return;
					}

					var originalLength = columnData[ix].length;
					columnData[ix] = columnData[ix].filter(function(val) {
						return (typeof val === 'number' && !isNaN(val));
					});

					var trimmedLength = columnData[ix].length;

					if(trimmedLength != originalLength) {
						$missingNotice.find(".grid").append(
							"<div class='column'>"
							+ "<i class='warning sign icon'></i> " + (originalLength - trimmedLength) 
								+ " of " + originalLength 
								+ " data points are identified as problematic data and are omitted."
							+ "</div>"
						);
						showing = true;
					}
					else {
						$missingNotice.find(".grid").append(
							"<div class='column'> <i class='info circle icon'></i> No Missing Data </div>"
						);
					}
				});

				if(showing) {
					$missingNotice.removeClass("hidden");
				}
				else {
					$missingNotice.addClass("hidden");
				}
			}

			return columnData;
		};

		// @brief	init modules and set module visibility
		module.render = function() {
			var columnName = $colDropdown.dropdown("get value");
			var indices = data.map(function(singleData) {
				return singleData["attribute"].findIndex(function(item) {
					return item["name"] == columnName;
				});
			});

			var types = indices.map(function(colIndex, ix) {
				var typeToCheck = (colIndex == -1) ? null : data[ix]["attribute"][colIndex]["type"];
				return getType(typeToCheck);
			});

			// identify column type inconsistency error
			var typesNotNull = Array.from(new Set(types.filter((val) => (val != null))));
			if(typesNotNull.length != 1) {
				$div.find(".plot.wrapper").showModuleError("Error: column data type inconsistent.");
				return;
			}

			var columnData = indices.map(function(colIndex, ix) {
				var dataObjToExtract = (colIndex == -1) ? null : data[ix]["data"];
				if(dataObjToExtract == null) return null;
				return dataObjToExtract.map(function(val) {
					return val[data[ix]["attribute"][colIndex]["name"]];
				});
			});

			var type = (types.filter((val) => (val != null)))[0];
			columnData = module.trimBadData(columnData, type);

			// obtain modules that needs rendering
			var names = [];
			if(type == "numeric") {
				names = ["box-plot", "histogram"];
			}
			else if(type == "nominal") {
				names = ["pie-chart", "column-chart"];
			}
			else {
				$div.find(".header-description").text("Error");
				$div.find(".plot.wrapper").showModuleError("This data type cannot be plotted.");
				return;
			}

			// initialize necessary modules
			var plotWrapper = $div.find(".plot.wrapper");
			plotWrapper.html("");
			names.forEach(function(name) {
				var moduleName = name.replace("-", "");
				plotWrapper.append($("<div>").addClass(name).html($div.find(".plot.templates").find("." + name).html()));
				if(type == "numeric") {
					plotWrapper.find("." + name)["dashboard_univariate_" + moduleName](
						columnData
					);
				}
				else {
					var oneofs = indices.map(function(colIndex, ix) {
						return (colIndex == -1) ? null : data[ix]["attribute"][colIndex]["type"]["oneof"];
					});
					plotWrapper.find("." + name)["dashboard_univariate_" + moduleName](
						columnData, 
						oneofs
					);
				}
			});

			// toggle show and hide
			plotTypes.forEach(function(type) {
				if(names.indexOf(type) != -1) {
					$plotDropdown.find(".item[data-value='" + type + "']").removeClass("disabled");
				}
				else {
					$plotDropdown.find(".item[data-value='" + type + "']").addClass("disabled");
				}
			});

			// set tab status
			if(names.indexOf($plotDropdown.dropdown("get value")) == -1) {
				$plotDropdown.dropdown("set selected", names[0]);
			}

			module.updatePlotVisibility($plotDropdown.dropdown("get value"));
			module.updateDescription();
		};

		// @brief	reset the module
		module.reset = function() {
			// if init has not been run, do nothing
			if(!$div) return;

			$div.find(".col-dropdown").html(""
				+ "<div class='ui fluid selection dropdown'>"
				+	"<div class='default text'>Select Column</div>"
				+	"<i class='dropdown icon'></i>"
				+	"<div class='menu'></div>"
				+ "</div>"
			);

			plotTypes.forEach(function(name) {
				var moduleName = name.replace("-", "");
				$div.find("." + name)["dashboard_univariate_" + moduleName]("reset");
			});
		};

		module.updateDescription = function() {
			$div.find(".header-description").text(module.description());
		};

		module.description = function() {
			return $plotDropdown.dropdown("get text") + " of " 
				+ $colDropdown.dropdown("get value");
		};

		module.init(renderTo, dataCopy);

	};

	$.fn.dashboard_univariate = function () {
		var args = Array.prototype.slice.call(arguments);
        return this.each(function () {
        	if(typeof args[0] == "string") {
				if($.data($(this), "module-data") !== undefined) {
        			$.data($(this), "module-data")[args[0]].apply(null, args.slice(1));
        		}        	
        	}
        	else {
        		(new (Function.prototype.bind.apply(Univariate, [null, $(this)].concat(args))));
        	}
        });
    };

}(jQuery));