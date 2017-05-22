Bivariate.stackedhistogram = (function($) {
	var module = {},
		$div,
		$graph,
		$rangeSelector,
		graph,
		histData = [],
		names = [],
		classes = []
		data = [];

	module.init = function(renderTo, seriesNames, dataCopy, classesCopy) {
		module.reset();

		$div = renderTo;
		names = seriesNames;
		data = dataCopy;
		classes = classesCopy;

		$graph = $div.find('.chart.image');
		$rangeSelector = $div.find(".ui.range");

		graph = new Highcharts.Chart({
			chart: {
				renderTo: $graph.get(0),
				type: 'column',
				style: {
					fontFamily: 'Lato'
				}
			},
			title: {
				text: ''
			},
			colors: (function () {
				var colors = [],
					base = '#3198f7',
					i,
					len = classes.length;

				for (i = 0; i < len; i += 1) {
					colors.push(Highcharts.Color(base).brighten((i - len / 2) / (len / 2 + 2)).get());
				}
				
				return colors;
			}()),
			xAxis: {
				categories: [],
				gridLineWidth: 1
			},
			xAxis: {
				min: 0,
				gridLineWidth: 1,
				tickmarkPlacement: 'on',
			},
			yAxis: [{
				title: {
					text: 'Histogram Count'
				}
			}],
			series: [],
			plotOptions: {
				column: {
					stacking: 'normal',
					pointPadding: 0,
					groupPadding: 0,
					pointPlacement: 'between'
				}
			},
			tooltip: {
				headerFormat: names[1] + ': <b>{series.name}</b><br/>',
				pointFormat: 'Histogram Count: <b>{point.y}</b> of {point.stackTotal}'
			},
			credits: {
			  enabled: false
			}
		});

		module.render(0);
	};

	module.render = function(numBins) {
		// need to suggest number of bins
		if(numBins == 0) {
			numBins = d3.thresholdFreedmanDiaconis(
				data[0], 
				d3.min(data[0]), 
				d3.max(data[0])
			);
			if(numBins < 2) numBins = 2;
			else if(numBins > 20) numBins = 20;

			$rangeSelector.ionRangeSlider({
				min: 2,
				max: 20,
				from: numBins,
				step: 1,
				postfix: ' bins',
				max_postfix: "+",
				grid: false,
				onFinish: function(data) {
					module.render(data.from);
				}
			});
		}

		var min = d3.min(data[0]);
		var max = d3.max(data[0]);
		var ticks = d3.ticks(min, max, numBins);
		var tickInterval = d3.tickStep(min, max, numBins);

		ticks.splice(0, 0, ticks[0] - tickInterval);

		$rangeSelector.data("ionRangeSlider").update({
			from: ticks.length
		});
		
		histData = classes.map(function(item) {
			var counts = [];
			var itemData = data[0].filter(function(val, ix) {
				return (data[1][ix] == item);
			});
			counts = ticks.map(function(tickValue, ix) {
				return itemData.filter(function(val) {
					return (val >= ticks[ix] && val < ticks[ix] + tickInterval)
				}).length;
			});

			return {
				name: item,
				type: 'column',
				data: counts
			};
		});

		while(graph.series.length > 0)
			graph.series[0].remove(false);

		for(var ix in histData) {
			graph.addSeries(histData[ix]);
		}

		graph.xAxis[0].setCategories(ticks);
	}

	module.reset = function() {
		// if init has not been run, do nothing
		if(!$div) return;

		data = [];
		$graph.html("");
	};

	return module;
	
}(jQuery));