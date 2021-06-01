/* 
Class which represents a nominator
*/
export class Nominator{
    //private variables
    _nom_address;//nominator address
    _bond;//nominator bond, full value in integer format

    
    constructor(nom_address, bond){
        this._nom_address=nom_address; 
        this._bond=parseInt(bond,10);//bond is casted to int
    }

    //Accessor method for private _bond, value converted to KSM
    getBond(){
        return this._bond/1000000000000;
    }
}