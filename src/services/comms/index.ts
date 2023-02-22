import { AcelaCore } from "..";
import { VoterCore } from "./voter";


export class CommsCore {
    self: AcelaCore;
    voter: VoterCore;
    constructor(self: AcelaCore) {
        this.self = self;
    }


    async start() {
        this.voter = new VoterCore(this.self)

        this.voter.voteRound()
    }
}