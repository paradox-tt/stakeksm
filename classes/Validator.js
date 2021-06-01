import {Nominator} from "./Nominator.js";
/* 
Class which represents a validator
*/
export class Validator{
    
    _primary; //Primary Identity
    _sub; //Sub Identity
    _address; //Public Address (Stash)
    _commission; //Commission raw
    _self_stake; //Selfstake raw
    _active_nominators;//Array of active nominators
    _nominators;//Array of inative nominators

    //Blank constructor
    constructor(){}

    //Formats the public address with pre tags to allow for copy/paste
    getFormattedAddress(){
        if(this._address!=undefined){
            return '<pre>'+this._address+'</pre>';
        }else{
            return undefined;
        }
    }
    
    //Formats the public address with reference to cryptolabs for charting
    getCryptoLabLink(){
        if(this._address!=undefined){
            return '<a href="'+this._address+'">Validator Stats</a>';
        }else{
            return undefined;
        }
    }

    //Returns selfstake in KSM with two decimal places
    getSelfStake(){
        if(this._self_stake!= undefined){
            return parseFloat((this._self_stake/1000000000000)).toFixed(2);
        }else{
            return 0;
        }
    }

    //Returns commission in percentage format with two decimal places
    getCommission(){

        if(this._commission!= undefined){
            var commission = this._commission/10000000;
            /*
            In some scenarios the commission is 1 resulting in a very small but not 0
            value for the commission (1x10^-7).  The logic below represents small commissions as 0
            */
            if(commission>0.0001){
                return parseFloat(commission).toFixed(2)+"%"
            }else{
                return "0.00%";
            }
            
        }else{
            //Issues are represented as negative 0 percent
            return "-0.00%";
        }
    }

    /*
    Developed but not used

    This function captures active nominators based on input of a map
    */
    setActiveNominators(others){
        //Instantiates the private variable _active_nominators
        this._active_nominators = new Array(others.length);

        //Iteration of each nominator in the map
        others.forEach(nominator => {
            
            if(nominator.who!=undefined && nominator.value!=undefined){
                //who property of the object contains the address
                //value property of the object contains the bond value
                var nom = new Nominator(nominator.who,nominator.value)
                
                //Add the nominator to the _active_nominators array
                this._active_nominators.push(nom);
            }
        });  
    }

    /*
    Developed but not used

    Function to return the sum of all active nominator's bond
    rounded to two decimal places.
    */
    getActiveNominatorBond(){
        var bondTally=0;

        this._active_nominators.forEach(nominator=>{
            bondTally+=nominator.bond;
        });

        return parseFloat((bondTally/1000000000000)).toFixed(2);

    }

     /*
    Function to return the sum of all nominator's bond
    rounded to two decimal places.
    */   
    getNominatorBond(){
        var bondTally=0;

        if(this._nominators!=undefined){
            this._nominators.forEach(nominator=>{
                bondTally+=nominator.getBond();
            });
        }

        return parseFloat(bondTally).toFixed(2);
    }

    /*
    Function to return the count of the nominator array
    */
    getNominatorCount(){
        if(this._nominators!=undefined){
            return this._nominators.length;
        }else{
            return 0;
        }
    }

    /*
    Function to return the count of the active nominator array
    */
    getActiveNominatorCount(){
        if(this._active_nominators!=undefined){
            return this._active_nominators.length;
        }else{
            return 0;
        }
    }

    //Adds a dormant nominator
    addNominator(nominator){
        
        if(this._nominators==undefined){
            this._nominators=[nominator];
        }else{
            this._nominators.push(nominator);
        }
    }


    /*
    Gets the validator name based on primary and sub names
    If both are available then return them both with a '/' separator
    If the sub is undefined but the primary is not then return the primary
    finally if neither is available return the address
    */
    getValidatorName(){
        var output;

       if (this._primary != undefined && this._sub != undefined) {
           output= this._primary+"/"+this._sub;
       } else if (this._sub == undefined) {
           output = this._primary;
       }else {
           output = this._address;
       }

           return output;
    }

   toString(){
       return this.getValidatorName();
   }

};


