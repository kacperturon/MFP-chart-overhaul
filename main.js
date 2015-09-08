function main(){
	var moving_average_lookback=7;
	var oneDay=24*60*60*1000;
	var chart_options;
	var daily_data,moving_data;
	var date_range = [];
	var reportInfo={
		'catergory':"progress",
		'name':"weight",
		'period':7
	};

	var measurements = {
		'Weight' : null,
		'Neck' : null,
		'Waist' : null,
		'Hips' : null,
	}

	$(document).ready(function (){
		createChartBasics(true,true);
		console.log("ready");
		$(".period.active").click();
	});

	$(document).ajaxComplete(function (event,xhr,settings){
		var urlInfo=parseUrl(settings.url)
		if(settings.type=="GET"&&urlInfo.isReport){
			if(urlInfo.isOverhaul)
				return;
			var new_reportInfo=urlInfo.report;
			var measurement = getMeasurementByName(new_reportInfo.name);
			if(new_reportInfo.category=='progress' && (new_reportInfo.name!=reportInfo.name||measurement==null)){
				makeMeasurementRequest(new_reportInfo,365);
			} else {
				updateChart(new_reportInfo, false);
			}
		}
	});

	function updateChart(new_reportInfo, force_update) {
		if(new_reportInfo.category=='progress') {
			if(reportInfoChanged(new_reportInfo) || force_update) {
				var measurement = measurements[reportInfo.name];
				showChart(measurement);
			}
		}else{
			hideChart();
		}
	}

	function makeMeasurementRequest(new_reportInfo, period_length) {
		$.get("http://www.myfitnesspal.com/reports/results/"+new_reportInfo.category+"/"+new_reportInfo.id+"/"+period_length+".json?report_name="+new_reportInfo.name+"&overhaul",function (raw_results){
			parseData(raw_results);
			updateChart(new_reportInfo, true);
		});
	}

	function getMeasurementByName(name) {
		return measurements[name];
	}

	function setMeasurementByName(name, measurement) {
		measurements[name] = measurement;
	}

	function parseUrl(url){
		var result={
			'isOverhaul':url.includes("overhaul"),
			'isReport':url.includes("/reports/results"),
			'report':null};
		if(result.isReport){
			var suburl=url.substring(url.indexOf("/reports/results")+17);
			var tokenized=suburl.split(/[/?&.=]+/);
			result.report={
				'category':tokenized[0],
				'name':tokenized[5],
				'period':parseInt(tokenized[2]),
				'id':1,
			};
			if(result.report.name=='Neck')
				result.report.id=82719721;
			else if(result.report.name=='Waist')
				result.report.id=82719722;
			else if(result.report.name=='Hips')
				result.report.id=82719723;
		}
		return result;
	}

	function reportInfoChanged(new_reportInfo) {
		if(reportInfo.category == new_reportInfo.category &&
		reportInfo.name == new_reportInfo.name &&
		reportInfo.period == new_reportInfo.period)
			return false;
		reportInfo = new_reportInfo;
		return true;
	}

	function parseData(raw_results){
		var measurement = getMeasurementByName(raw_results.title);
		var raw_data = raw_results.data;
		measurement = {
			'data' : [],
			'daily_data' : [],
			'moving_data' : [],
			'lookback_limit' : 0,
		};

		cur_year=new Date().getFullYear();
		for(i=raw_data.length-1;i>=0;i--){
			var entry=raw_data[i];
			if(i>0){
				var prev_entry=raw_data[i-1];
				if(prev_entry.date>entry.date)
					cur_year--;
				if(entry.total!=prev_entry.total&&entry.total!=0){
					var cur_date=parseDateString(entry.date,cur_year);
					measurement.data.push({'date_string':entry.date,'dateUTC':cur_date,'total':entry.total});
				}
			}else{
				if(entry.total!=0){
					var cur_date=parseDateString(entry.date,cur_year);
					measurement.data.push({'date_string':entry.date,'dateUTC':cur_date,'total':entry.total});
				}
			}
		}

		measurement.data.reverse();
		var today = getToday();
		if(measurement.data.length>0&&measurement.data[measurement.data.length-1].dateUTC<today)
			measurement.data.push({'date_string':"today",'dateUTC':today,'total':measurement.data[measurement.data.length-1].total});
		measurement.daily_data=daily_value(measurement.data);
		measurement.moving_data=moving_average(measurement.data);
		measurement.lookback_limit = measurement.data[0].dateUTC;
		setMeasurementByName(raw_results.title, measurement);
	}

	function getToday() {
		var curTime=new Date();
		return Date.UTC(curTime.getFullYear(),curTime.getMonth(),curTime.getDate());
	}

	function getDateRange() {
		var curTime=new Date();
		var today = Date.UTC(curTime.getFullYear(),curTime.getMonth(),curTime.getDate());
		var lookback_day = today - reportInfo.period*oneDay;
		return [lookback_day, today];
	}

	function parseDateString(date_string,year){
		var split_string=date_string.split("/");
		var day=split_string[1];
		var month=split_string[0];
		return Date.UTC(year,month-1,day);
	}
``
	function DateDif(date1,date2){
		var diffDays=(date2-date1)/oneDay;
		return diffDays;
	}

	function daily_value(data){
		result=[];
		data.forEach(function (entry,index){
			result.push([entry.dateUTC,entry.total]);
		});
		return result;
	}

	function moving_average(data){
		var result=[];
		for(i=0;i<data.length;i++) {
			var entry = data[i];
			var sum = 0;
			var num = 0;
			for(j=i; j>=0; j--) {
				var cur_entry=data[j];
				if(DateDif(cur_entry.dateUTC,entry.dateUTC)>=moving_average_lookback){
					break;
				} else {
					sum+=cur_entry.total;
                    num++;
				}
			}
			var average = parseFloat((sum/num).toFixed(1));
			result.push([entry.dateUTC,average]);
		}
		return result;
	}

	function getTickInterval(x_min,x_max){
		var period=(x_max-x_min)/oneDay;
		if(period<=7){
			return oneDay;;
		}else if(period<=30){
			return 2*oneDay;
		}else if(period<=90){
			return 7*oneDay;
		}else{
			return 14*oneDay;
		}
	}

	function getLimits(measurement){
		var data = measurement.daily_data;
		var date_range = getDateRange();
		if(measurement.daily_data.length==0)
			return {'x_min':0,'x_max':2,'y_min':0,'y_max':1};
		var limits={'x_min':date_range[0],'x_max':date_range[1],'y_min':Number.MAX_VALUE,'y_max':Number.MIN_VALUE};
		for(i=measurement.daily_data.length-1;i>=0;i--){
			var entry = data[i];
			if(entry[0]<limits.x_min)
				return limits;
			var dataVal=entry[1];
			if(dataVal<limits.y_min)
				limits.y_min=dataVal;
			if(dataVal>limits.y_max)
				limits.y_max=dataVal;
			if(i==0)
				limits.x_min=entry[0];
		}
		return limits;
	}

	function createChartBasics(){
		chart_options=MFP.Reports.chart.options;
		chart_options.series[0].dataLabels.enabled=false;
		chart_options.series[0].marker.radius=2;
		var index=0;
		chart_options.series[1]=jQuery.extend(true,{},chart_options.series[0]);
		//chart_options.series[index].data=daily_data;
		chart_options.series[index].name="daily";
		chart_options.series[index].type="line";
		chart_options.series[index].marker.enabled=true;
		index++;
		//chart_options.series[index].data=moving_data;
		chart_options.series[index].name="average";
		chart_options.series[index].type="spline";
		index++;
		chart_options.plotOptions.line.lineWidth=0;
		var test_chart_options=chart_options;
		chart_options.chart.renderTo="highchart2";
		chart_options.tooltip={
			shared:true,
			headerFormat:"<spanstyle=\"font-size:10px\">{point.key}</span><br/>",
			pointFormat:"<spanstyle=\"color:{series.color}\">{series.name}</span> : <b>{point.y}</b><br/>",
		};
		chart_options.yAxis[0].minRange=1;
		chart_options.yAxis[0].minTickInterval=1;
		chart_options.yAxis[0].allowDecimals=false;
		chart_options.xAxis[0]={
			type:'datetime',
			lineColor:chart_options.xAxis[0].lineColor,
			tickColor:chart_options.xAxis[0].tickColor,
			tickmarkPlacement:"on",
			dateTimeLabelFormats:{day:'%b %d',week:'%b %d',month:'%b %d',year:'%b %d'},
			labels:chart_options.xAxis[0].labels
		};
		chart_options.xAxis[0].labels.step=1;
		chart_options.xAxis[0].labels.formatter=null;
	}

	function updateChartOptions(measurement){
		chart_options.series[0].data=measurement.daily_data;
		chart_options.series[1].data=measurement.moving_data;
		var limits=getLimits(measurement);
		chart_options.xAxis[0].min=limits.x_min;
		chart_options.xAxis[0].max=limits.x_max;
		chart_options.yAxis[0].min=limits.y_min;
		chart_options.yAxis[0].max=limits.y_max;
		chart_options.xAxis[0].tickInterval=getTickInterval(limits.x_min,limits.x_max);
	}

	function showChart(measurement){
		$(function (){
			$('#highchart2').show();
			$('#highchart').hide();
			updateChartOptions(measurement);
			$('#highchart2').highcharts(chart_options);
		});
	}

	function hideChart(){
		$('#highchart').show();
		$('#highchart2').hide();
	}
}

var div=$("#highchart").clone().attr("id","highchart2");
$(div).insertAfter($("#highchart"));
div.hide();
var script=document.createElement('script');
script.appendChild(document.createTextNode('('+main+')();'));
(document.body||document.head||document.documentElement).appendChild(script);
