import express from 'express'; //Required for endpoint
import {ApiPromise, WsProvider} from '@polkadot/api';//Required for chain interaction

//Classes
import {Validator} from "./classes/Validator.js";
import {Nominator} from "./classes/Nominator.js";

//Configurable variables
import {validator_list} from "./settings.js";
import {wss_provider} from "./settings.js";
import {listen_port} from "./settings.js";
import {cache_time} from "./settings.js";

//Initializes wsProvider and API Promise
const wsProvider = new WsProvider(wss_provider);
const api = await ApiPromise.create({ provider: wsProvider });


const era = await api.query.staking.activeEra();
const era_number = era.unwrap().index.toNumber();

//stores the last date and time of the output
var lastgen;

//stores the validator objects
var validator_obj_list;
//JSON array formatted output
var output;

// Set up the express app
const app = express();

//Establishes endpoint
app.get('/', async (req, res) => {

    //Sets the time for the next file generation, 60s x 1000ms
    var nextgen = lastgen+(cache_time*60*1000);

    /*
    If the output is undefined i.e. never generated and the first run then generate output, 
    alternatively if the current datetime exceeds the nextgen time then generate output.

    If neither criteria holds then the output maintains in the form of a cache

     */
    if(output==undefined||new Date().getTime()>nextgen){
        init();
        await createValidatorObjects();
        await loadDormantNominators();
        await loadOutputArray();

        lastgen = new Date().getTime();
        console.log('Output last generated on: '+ new Date(lastgen).toString());
    }else{
        console.log('Using cached output');
    }

    //return output in JSON format
    res.status(200).json(
        output
    );

});

//Listen for the connection on the specified port
app.listen(listen_port, () => {
  console.log(`Server running on port ${listen_port}`)
});


/*
Initialize the array which contains the validator objects 
and add the header row for the output.
*/
function init(){
    validator_obj_list = new Array();

    output=[
        ["Validator",
        "Address",
        "Stats",
        "Fee",
        "Self Bond",
        "Nom Bond",
        "Nominators"]
    ];
}

/* 
This function iterates through the supplied validator listing and converts each
to validator objects with the validator names, commission, active nominators and bond.

All async operations are finalized in Promise all and then added to the validator 
object array
*/

async function createValidatorObjects(){

    for (let i = 0; i < validator_list.length; i++) {

        let val = new Validator();
    
        let validatorAddress = validator_list[i].toString();   
    
        //Extract information for name
        const pns = api.derive.accounts.info(validatorAddress).then((name) => {
            val._primary = name.identity.displayParent;
            val._sub = name.identity.display;
        }).catch((name)=>{console.log("Error | Get validator name: "+name.toString())});
    
        //Extract information for commission
        const com = api.query.staking.validators(validatorAddress).then((com) => {
            val._commission= parseInt(com.toJSON().commission,10);
        }).catch((com)=>{console.log("Error | Get commission: "+com.toString())});
    
        //Extract information for active stakers
        const nom = api.query.staking.erasStakers(era_number, validatorAddress).then((nom) => {
            val.setActiveNominators(nom.others);
        }).catch((anom)=>{console.log("Error | Get active validators: "+anom.toString())});
    
        //Get the self bond
        const ss = getActiveBond(validatorAddress).then((ss) => {
            val._self_stake= ss;
        }).catch((sstake)=>{
            console.log("Error | Get active bond "+cont.toString());
            val._self_stake=0;
        });
              
        //Finalize all threaded execution and add to the validator object list
        Promise.all([pns,com,nom,ss]).then((values)=>{
            val._address = validator_list[i].toString();
            validator_obj_list[validatorAddress] = val;
        }).catch((cont)=>{
            console.log("Error | Setting promise all validator: "+cont.toString())
        });  
        
    };
}

/* 
This function maps nominators to the validators objects established in createValidatorObjects()

Staking.nomintors provides output of a nominator and a Map of its associated validators. 
If a nominator contains one of the listed validtors it is added to the validators list of 
nominators along with its bond.
*/
async function loadDormantNominators() {

    //Get list of nominators with their associated validators
    //TODO: error handling in the event that the Promise is not fulfilled.
    const nominators = await api.query.staking.nominators.entries();

    //If nominators isn't undefined
    if(nominators!=undefined){

        //For each nominator and its validator pairing
        for(let [nom_addresses,validators] of nominators){
            
            //Extract the nominator address from the key
            var nom_address = nom_addresses.toHuman()[0];
            var val_address;
            var found;

            try{
                //If the validator list is defined
                if(validators!=undefined){
                    //Iterate through each validator, extract its address (v_address)
                    //If the validator exists in the user supplied validator list then
                    //designate it as found
                    validators.toJSON().targets.map((v_address)=>{
                        found = validator_list.find(x=>x==v_address);
                        val_address=v_address;
                    });
                }else{
                    console.log('Error | Dormant Nominators: empty nomination');    
                }
            }catch(val_error){
                console.log('Error | Dormant Nominators: '+val_error);
            };

            /*
            If the validator is found in the nominators list, get the nominator's bond,
            form a nominator object and add the object to the respective validator
            */
            if(found!=undefined){
                var bond;
                //Get active bond of nominator  
                await getActiveBond(nom_address).then(active_bond=>{
                    bond=active_bond;
                }).catch(gab_error=>{
                    console.log('Error | Dormant Nominators | Get Active Bond: '+gab_error);
                });

                //Create nominator object
                var nom_obj = new Nominator(nom_address,bond);
                //Add nominator object to the respective validator
                validator_obj_list[val_address].addNominator(nom_obj);
            }
        }
    }  
  };

/* 
  Iterate through each validator in the user supplied validator list,
  extract the corresponding validator from the validator object list 
  and issue the relevant data presentation methods
*/
async function loadOutputArray(){
    validator_list.forEach(element=>{

        output[output.length] = [
                                validator_obj_list[element].getValidatorName(),
                                validator_obj_list[element].getFormattedAddress(),
                                validator_obj_list[element].getCryptoLabLink(),
                                validator_obj_list[element].getCommission(),
                                validator_obj_list[element].getSelfStake(),
                                validator_obj_list[element].getNominatorBond(),
                                validator_obj_list[element].getNominatorCount(),
                                ];
        
        });
}
/* 
Gets the active bond for a stash address, the process of which determines
whether there's an associated controller before returning the figure. If
there is a controller then lookup the ledger based on the controller.
*/
async function getActiveBond(stashAddress){
    var output;
    var controllerAddress;

    //Determine controller address
    await api.query.staking.bonded(stashAddress).then(controller=>{
        controllerAddress=controller.value.toString();
    })
    
    //Lookup the value of the bond using the controller
    await api.query.staking.ledger(controllerAddress).then(bond=>{
        if(bond !=undefined && bond.value.toJSON()!=null){
            try{
                output=bond.value.active.toNumber();
            }catch(err){
                output=undefined;
            }
        }
        else{
            output=undefined;
        }
    }).catch(led_err=>{
        console.log('', err);
        output = undefined;
    });

    return output;
}
