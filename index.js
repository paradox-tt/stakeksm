import express from 'express';
import {ApiPromise, WsProvider} from '@polkadot/api';

import {Validator} from "./classes/Validator.js";
import {Nominator} from "./classes/Nominator.js";


import {validator_list} from "./settings.js";
import {wss_provider} from "./settings.js";
import {listen_port} from "./settings.js";

const wsProvider = new WsProvider(wss_provider);
const api = await ApiPromise.create({ provider: wsProvider });
const PORT = listen_port;

const era = await api.query.staking.activeEra();
const era_number = era.unwrap().index.toNumber();

//stores the validator objects
var validator_obj_list;
//JSON array formatted output
var output;

// Set up the express app
const app = express();

//Establishes endpoint
app.get('/', async (req, res) => {

    //Initializes global variables
    init();

    /*
    Creates validator objects and inserts them into
    validator_obj_list
    */
    await createValidatorObjects();

    /* 
    Load the dormant nominators for each validator in
    the validator_obj_list
    */
    await loadDormantNominators();
    await loadOutputArray();
    
    res.status(200).send(
        JSON.stringify(output)
    );

});


app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
});

function init(){
    validator_obj_list = new Array();

    output=[
        "Validator",
        "Address",
        "Stats",
        "Fee",
        "Self Bond",
        "Active Bond",
        "Nominators"
    ];
}


async function createValidatorObjects(){

    for (let i = 0; i < validator_list.length; i++) {

        let val = new Validator();
    
        let validatorAddress = validator_list[i].toString();   
    
        const pns = api.derive.accounts.info(validatorAddress).then((name) => {
            val._primary = name.identity.displayParent;
            val._sub = name.identity.display;
        }).catch((cont)=>{});
    
        const com = api.query.staking.validators(validatorAddress).then((com) => {
            val._commission= parseInt(com.toJSON().commission,10);
        }).catch((cont)=>{console.log("error with com "+cont.toString())});
    
        const nom = api.query.staking.erasStakers(era_number, validatorAddress).then((nom) => {
            val.setActiveNominators(nom.others);
        }).catch((cont)=>{console.log("error with nom "+cont.toString())});
    
        const ss = getActiveBond(validatorAddress).then((ss) => {
            val._self_stake= ss;
        }).catch((cont)=>{
            console.log("error with ss "+cont.toString());
            val._self_stake=0;
        });
              
        Promise.all([pns,com,nom,ss]).then((values)=>{
            val._address = validator_list[i].toString();
            validator_obj_list[validatorAddress] = val;
        }).catch((cont)=>{console.log("error with json "+cont.toString())});  
        
    };
}

async function loadDormantNominators() {

    const nominators = await api.query.staking.nominators.entries();

    if(nominators!=undefined){

        for(let [nom_addresses,validators] of nominators){
                
            var nom_address = nom_addresses.toHuman()[0];
            var val_address;
            var found;

            validators.toJSON().targets.map((v_address)=>{
                found = validator_list.find(x=>x==v_address);
                val_address=v_address;
                //console.log(v_address);
            });

            if(found!=undefined){
                var bond;  
                await getActiveBond(nom_address).then(x=>{
                    bond=x;
                });

                var nom_obj = new Nominator(nom_address,bond);
                
                validator_obj_list[val_address].addNominator(nom_obj);
            }
        }
    }  
  };

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

async function getActiveBond(stashAddress){
    var output;
    var controllerAddress;

    await api.query.staking.bonded(stashAddress).then(controller=>{
        controllerAddress=controller.value.toString();
    })
    
    try{
        await api.query.staking.ledger(controllerAddress).then(bond=>{
            if(bond !=undefined && bond.value.toJSON()!=null){
                try{
                    output=bond.value.active.toNumber();
                }catch(err){
                    output=0;
                }
            }
            else{
                output=undefined;
            }
        });
    }catch(err){
        console.log('', err);
        output = undefined;
    }
    return output;
}
