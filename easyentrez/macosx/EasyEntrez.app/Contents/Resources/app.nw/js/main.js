function openUrl(url){
	// Open URL with default browser.
	gui.Shell.openExternal(url);
}

function openText(path){
	// Open a text file with default text editor.
	gui.Shell.openItem(path);
}

function openFolder(path){
	// Open a file in file explorer.
	gui.Shell.showItemInFolder(path);
}

function chooseFile(name) {
	var chooser = $(name);
	chooser.trigger('click');            
	chooser.change(function(evt) {
		console.log($(this).val());
	});
}

function chooseDownloadPath(name){
	var chooser = $(name);
	chooser.trigger('click');
	chooser.change(function(evt){
		var resdata = $.parseJSON($("#ExtractParams").val());	
		performRetRequest($(this).val(), $("#entrez-type").val(), resdata);
	});
}


//Entrez core function
function showEntrezParams(){
	var type = $("#entrez-type").val();
	
	$(".sec-entry").val('');
	$(".sec-entry").css("display", "none");
	$("#extra_params").css("display", "none");
	
	switch(type){
		case "esearch":
			//alert("ESearch");
			
			$("#entrez-db").css("display", "");
			break;
		case "esummary":
			//alert("ESummary");
			
			$("#entrez-db").css("display", "");			
			break;
		case "efetch":
			//alert("EFetch");

			$("#entrez-db").css("display", "");			
			break;
			
		default:
			alert("Please specify NCBI E-Utils Program");
			break;
	}
}


function updateEntrezDb(){

	$("#extra_params").css("display", "none");
	var type = $("#entrez-type").val();
	
	if(type == "efetch"){
	
		$("#entrez-rettype").empty();
	
		var db = $("#entrez-db").val();
		$("#extra_params").css("display", "");
		//console.log(db);
		if(json_efetchdata[db]['rettype'] != undefined){
			for(var i = 0; i < json_efetchdata[db]['rettype'].length; i++){			
				$("#entrez-rettype").append("<option value='" + json_efetchdata[db]['rettype'][i] + ":" + json_efetchdata[db]['retmode'][i] + "'>" + json_efetchdata[db]['name'][i] + "</option>");
			}
		}
	}
}

function submitRequest(){
	$("#entrez-form-buttons").css("display", "none");
	var utils = $("#entrez-type").val();
	var keyword = $("#entrez-query").val();	
	var db = $("#entrez-db").val();
	var params = $("#entrez-rettype").val();	
	
	var rettype, retmode;
	if(params != undefined && params != ""){
		if(/(.*):(.*)/.test(params)){
			rettype = RegExp.$1;
			retmode = RegExp.$2;
		}
	}
	
	var postdata = {
		"db" : db,
		"term" : keyword,
		"usehistory" : "y"
	}
	
	var postdata2 = {};
	
	if(rettype != undefined && retmode != undefined){
		postdata2 = {
			"rettype" : rettype,
			"retmode" : retmode	
		}
	}
	
	performSearchRequest(utils, postdata, postdata2);	

}

function performSearchRequest(utils, postdata, postdata2){

	var post_data = querystring.stringify(postdata);  	
	var options = {
	   host: 'eutils.ncbi.nlm.nih.gov',
	   port: 80,
	   //path: '/' +  + '.cgi',
	   path: '/entrez/eutils/esearch.fcgi?' + post_data,
	   method: 'GET'
	};
	
	var recordcount, querykey, webenv;
		
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		var resdata = "";
		res.on('data', function (chunk) {
			//console.log('BODY: ' + chunk);
			resdata += chunk;
		});
		
		res.on('end', function(){
			console.log(resdata);
			
			if(/\<Count\>(.*)\<\/Count\>/.test(resdata)){
				recordcount = RegExp.$1;
			}
			
			if(/\<QueryKey\>(.*)\<\/QueryKey\>/.test(resdata)){
				querykey = RegExp.$1;
			}
			
			if(/\<WebEnv\>(.*)\<\/WebEnv\>/.test(resdata)){
				webenv = RegExp.$1;
			}
						
			if(querykey != "" && webenv != ""){
			
				var retdata = {
					db : postdata['db'],
					query_key : querykey,
					WebEnv : webenv,
					retmax : 50,
					retstart : 0,
				}
				
				if(utils == "efetch"){
					retdata['rettype'] = postdata2['rettype'];
					retdata['retmode'] = postdata2['retmode'];
				}
				
				//performRetRequest(utils, retdata);
				$("#entrez-form").css("display", "none");
				$("#entrez-form-buttons").css("display", "none");
				$("#extract-confirm-buttons").css("display", "");
				
				$("#ExtractConfirm").html(recordcount + ' is found, ready to download?');
				$("#ExtractTotal").val(recordcount);
				$("#ExtractParams").val(JSON.stringify(retdata));
			
			}
						
		});
	});

	req.on('error', function(e) {
	  console.log('problem with NCBI eutils esearch request: ' + e.message);
	});

	req.end();

}

function performRetRequest(filepath, utils, postdata){

	var total = $("#ExtractTotal").val();
	
	//Record work settings to data folder
	var settings = postdata;
	settings['total'] = total;
	settings['utils'] = utils;
	settings['term'] = $("#entrez-query").val();
	settings['db'] = $("#entrez-db").val();	
	settings['taskid'] = Math.round(new Date().getTime() / 1000);
	settings['filepath'] = filepath;
	fs.writeFileSync("./data/task_" + settings['taskid'] + ".json", JSON.stringify(settings));
	$("#tasklist").append("<input type='hidden' id='task" + settings['taskid'] + "' data-start='0' data-total='" + total + "' />");	
	$("#tasklist").append("<div id=\"progressbar_" + settings['taskid'] + "\" class=\"progress progress-striped\"><p>Running task #" + settings['taskid'] + " ...</p><div class=\"bar\" style=\"width: 0%;\"></div><br /></div>");
	
	var taskid = settings['taskid'];
	taskinterval[taskid] = setInterval(function(){
		execTask(filepath, utils, postdata, settings['taskid'], 500);
	}, 5000);
	execTask(filepath, utils, postdata, settings['taskid'], 500);
	
	$("#StartEntrezModal").modal("hide");
	
}

function execTask(filepath, utils, postdata, taskid, max){

	var taskobj = $("#task" + taskid);
	
	if(parseInt(taskobj.attr('data-start')) >= parseInt(taskobj.attr('data-total'))){
		try{
			clearInterval(taskinterval[taskid]);
		}catch(e){
			console.log(e);
		}
	} else {
		//calculate progress
		var progress_percent = (parseInt(taskobj.attr('data-start')) / parseInt(taskobj.attr('data-total'))) * 100;
		$("#progressbar_" + taskid + " > div").css("width", progress_percent + "%");
	}

	if(taskobj != undefined && (parseInt(taskobj.attr('data-start')) < parseInt(taskobj.attr('data-total')))){
		console.log("ready to fetch from ..." + taskobj.attr('data-start'));
		
		postdata['retstart'] = taskobj.attr('data-start');
		postdata['retmax'] = max;  	
		var post_data = querystring.stringify(postdata);		
		//console.log(postdata);
		//console.log(post_data);
		var options = {
		   host: 'eutils.ncbi.nlm.nih.gov',
		   port: 80,
		   path: '/entrez/eutils/' + utils + '.fcgi?' + post_data,
		   method: 'GET'
		};


		var req = http.request(options, function(res) {
			res.setEncoding('utf8');
			var resdata = "";
			res.on('data', function (chunk) {
				//console.log('BODY: ' + chunk);
				resdata += chunk;
			});

			res.on('end', function(){
				//console.log(resdata);			
				fs.writeFileSync(filepath + "/task" + taskid + "_tmp" + postdata['retstart'], resdata);
				taskobj.attr('data-start', parseInt(taskobj.attr('data-start')) + parseInt(max));
			});
		});

		req.on('error', function(e) {
		  console.log('problem with NCBI eutils esearch request: ' + e.message);
		});

		req.end();
	} else {
		console.log("task object " + taskid + " not found.");
	}
}

function previewRequest(){
	var utils = $("#entrez-type").val();
	var keyword = $("#entrez-query").val();	
	var db = $("#entrez-db").val();
	var params = $("#entrez-rettype").val();

	var previewurl = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=" + db + "&term=" + keyword;
	//console.log("Ready to open url:" + previewurl);
	openUrl(previewurl);
}

function downloadRequest(){
	chooseDownloadPath("#ExtractDir");
}