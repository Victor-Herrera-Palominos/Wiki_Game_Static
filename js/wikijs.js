
/**
 * Author: Victor H
 * Javascript(AngularJS) file which handles API calls to Wikipedia It also dynamically modifies content on 
 * the main webpage, such as hiding and showing HTML elements for saving to the database, the dropdown menu
 * and error messages
 */

var wikiGameApp = angular.module('wikiGame', []);

wikiGameApp.factory('wikiApi', function($http, $q) {
	
	var fac = {};

	/**
	 * 	Description: API Call to Wikipedia for all the wikipedia titles/links found in the chosen article
	 *	Is recursive for when the API call reaches the limit of included titles(500), and has to call again
	 *  Is also recursive for when a title is selected at random for a new API call with it as the chosen article
	 *
	 * 	@param  {String} 	urlTitle 		Title of the article
	 * 	@param	{String}	plContinue   	Used to continue the call from the stopping point of previous call
	 * 	@param  {Array} 	linkArray 		Titles found in the article are stored here
	 *	@param  {Integer} 	arrayIndex   	Index used to fill linkArray
	 *	@param  {Integer} 	totalDegree   	How many degrees of separation there will be between the starting article and the destination article
	 *	@param  {Integer} 	currentDegree   Keeps track of what degree it is currently at
	 *	@param  {deferred}	deferred   		Deferred object to resolve the promise with linkArray
	 *
	 *	@return {deferred}  deferred.promise	The deferred's promise object, is named 'promise' in recursive returns
	 */
	
	fac.wikiGet = (urlTitle, plContinue, linkArray, linkIndex, totalDegree, currentDegree, deferred) => {
		//API Call with chosen article, and plContinue if there are more links to be found
		var url = "https://en.wikipedia.org/w/api.php?action=query&origin=*&prop=links&titles=" + urlTitle + plContinue + "&plnamespace=0&pllimit=max&format=json";
		//Because of potential recursion, ensures the deferred object is only created at the beginning
		if(deferred === null)
		{
			console.log("(wikiGet) Should only be seen once");
			deferred = $q.defer();
		}
		
		return $http.get(url)
			.then(function(response) {
				//Requires the pageid before being able to extract the titles from the article
				var pageid = Object.keys(response.data.query.pages);
				//pageid is -1 if no wikipedia article with that title exists
				if(pageid[0] === "-1")
				{
					console.log("pageid is -1");
					deferred.reject("No such page");
					return deferred.promise;
				}
				//Extracts titles from response objects and stores them in linkArray
				var titles = response.data.query.pages[pageid].links;
				for(title in titles) {
					linkArray[linkIndex]= titles[title].title;
					linkIndex++;
				}
				//Checks if there are more titles in the article
				if(response.data.continue != null)
				{
					plContinue = "&plcontinue=" + response.data.continue.plcontinue;
					//Recursive call to get other titles in article, returns an already resolved promise
					fac.wikiGet(urlTitle, plContinue, linkArray, linkIndex, totalDegree, currentDegree, deferred).then(function(promise) {
						return promise;
					})
				}
				else {
					//Either continues with recursive calls to a new article randomly picked from the titles in linkArray
					if(currentDegree < totalDegree)
					{
						urlTitle = linkArray[Math.floor(Math.random() * linkArray.length)]
						console.log(urlTitle);
						//Recursive call with a new article to get titles from, returns and already resolved promise
						fac.wikiGet(urlTitle, "", [], 0, totalDegree, (currentDegree+1), deferred).then(function(promise) {
							return promise;
						})
					}
					//Or resolves the promise so that it can be returned
					else{
						deferred.resolve(linkArray);
					}
				}
				return deferred.promise;
		});
	}
	
	/**
	 * 	Description: API Call to Wikipedia to get any random article
	 *
	 *	@return {deferred}  deferred.promise   	Name of random article is in the resolved promise
	 */
	fac.wikiRandom = () => {
		var deferred = $q.defer();
		console.log("In wikiRandom");
		//Wikipedia API call which returns random articles
		return $http.get("https://en.wikipedia.org/w/api.php?action=query&origin=*&list=random&rnnamespace=0&rnlimit=1&format=json")
			.then(function(response) {
				//Returns the first random article title
				deferred.resolve(response.data.query.random[0].title);
				return deferred.promise;
		});
	}
	
	return fac;
});

wikiGameApp.controller('wikiCtrl', function($scope, wikiApi){

	//Default values shown in input fields on site
	$scope.startTitle = "Kevin Bacon";
	$scope.inputDegrees = 2;
	
	
	/** 
	 * 	Description: Calls the wikiGet function from the factory
	 *	Return array from wikiGet is stored in $scope.allTitles to verify the next link and to include autocomplete
	 *
	 * 	@param  {String}	urlStart 	Title of the article input by the user
	 */
	$scope.chosenLink = (urlStart) => {
		$scope.articleError = true;
		$scope.nextError = true;
		//Calls wikiGet with the chosen title, no plContinue, an empty array with index at 0, the degree is set to 1, and the deferred object is null
		wikiApi.wikiGet(urlStart, "", [], 0, 1, 1, null).then(function(data){
			console.log("Return from wikiGet to chosenLink");
			$scope.allTitles = data;
		}).catch(function(error){
			$scope.articleError = false;
			console.log("Error: " + error);
			return;
		});
	}
	
	/**
	 * 	Description: Calls the chosenLink function with a new article, and modifies the path of links/titles taken so far
	 *
	 */
	$scope.nextLink = () => {
		//Takes user input from the 'nextlink' input in HTML
		var urlTitle = $scope.nextTitle;
		$scope.nextTitle = "";
		//Checks that user input is a link/title that exists in current wikipedia article
		if($scope.allTitles.indexOf(urlTitle) === -1) {
			$scope.nextError = false;
			return;
		} else {
			//Modifies the path of links/titles accordingly
			$scope.chosenLink(urlTitle);
			if(urlTitle === $scope.endTitle)
			{
				$scope.linkPath = $scope.linkPath.replace("? -> ", "");	
				$scope.hideLink = true;
				$scope.storeDB = false;
			}
			else {
				$scope.linkPath = $scope.linkPath.replace("?", urlTitle + " -> ?");	
			}	
		}
	}
	
	/**
	 * 	Description: Calls the chosenLink function with the starting article and another chosenLink call with # degrees to get the destination aricle
	 *
	 */
	$scope.degreeRandom = () => {
		//Takes user input from the 'starttitle' input in HTML
		var urlStart = $scope.startTitle;
		//Takes user input from the 'indegrees' input in HTML
		var inputDeg = parseInt($scope.inputDegrees);
		$scope.degError = true;
		if(inputDeg === 0 || isNaN(inputDeg))
		{
			$scope.degError = false;
			return;
		}
		
		//Resets prior path and hides prior destination link
		$scope.pathLink = "";
		$scope.linkDest = true;
		$scope.chosenLink(urlStart);
		wikiApi.wikiGet(urlStart,"",[],0,inputDeg,1,null).then(function(data) {
			console.log("Return from wikiGet to degreeRandom");
			//Selects random destination title from returned array
			$scope.endTitle = data[Math.floor(Math.random() * data.length)]
			//Shows new path and destination
			$scope.linkPath = urlStart + " -> ? -> " + $scope.endTitle;
			$scope.linkDest = false;
		}).catch(function(error){
			$scope.articleError = false;
			console.log("Error: " + error);
			return;
		});
	}
	
	/**
	 * 	Description: Calls the chosenLink function with the starting article and wikiRandom from factory to get any random article in Wikipedia
	 *
	 */
	$scope.fullRandom = () => {
		//Takes user input from the 'starttitle' input in HTML
		var urlStart = $scope.startTitle;
		//Resets prior path and hides prior destination link
		$scope.linkPath = "";
		$scope.linkDest = true;
		$scope.chosenLink(urlStart);
		wikiApi.wikiRandom().then(function(data) {
			console.log("Return from wikiRandom");
			$scope.endTitle = data;
			//Shows new path and destination
			$scope.linkPath = urlStart + " -> ? -> " + data;
			$scope.linkDest = false;	
		})
	}
	
	/**
	 * 	Description: Creates a drop down of current article titles that autocompletes based on what the user has written
	 *
	 * 	@param  {String)  userString	What the user has written so far in the "nextlink" input
	 */
	$scope.autoComp = (userString) => {
		//Array that is filled with the found titles based on what the user has inputted
		var foundTitles = [];
		//Checks user input in "nextlink" and compares to all the titles in article. Stores them in array
		angular.forEach($scope.allTitles, (nextTitle) => {
		if (nextTitle.toLowerCase().indexOf(userString.toLowerCase()) === 0 && (userString.length > 0)) {
			foundTitles.push(nextTitle);
			}
		});
		//
		$scope.dropDown = foundTitles;
		/**
		 * 	Description: Sets the nexTitle used in the nextLink function based on what the user clicks
		 *
		 * 	@param  {String) selectedTitle	Title user clicks on in the drop down meny
		 */
		$scope.selectTitle = (selectedTitle) => {
			$scope.nextTitle = selectedTitle;
			//Closes the drop down menu and empties it
			$scope.hideDrop = true;
			$scope.dropDown = [];
		}
	}
	
	$scope.onBlur = function() 
	{
		$scope.hideDrop = true;
	};

	$scope.onFocus = function() 
	{
		$scope.hideDrop = false;
	};
});