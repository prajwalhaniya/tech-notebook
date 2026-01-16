---
sidebar_position: 1
---

# Design a Parking Lot

### Problem Statement

A parking lot is a designated area for parking vehicles, commonly found in venues like shopping malls, sports stadiums, and office buildings. 
It consists of a fixed number of parking spots allocated for different types of vehicles. Each spot is charged based on the duration a vehicle remains parked. 

Parking time is tracked using a parking ticket issued at the entrance. Upon exit, the customer can pay using either an automated exit panel or through a parking agent, with a credit/debit card or cash as accepted payment methods.

`Some of the questions to ask`

- How are customers able to pay at different exit points (i.e., either at the automated exit panel or to the parking agent) and by different methods (cash, credit, coupon)?
- If there are multiple floors in the parking lot, how will the system keep track of the customer having already paid on a particular floor rather than at the exit?
- How will the parking capacity of each lot be considered?
- What happens when a lot becomes full?
- How can one keep track of the free parking spots on each floor if there are multiple floors in the parking lot?
- How will the division of the parking spots be carried out among the four different parking spot types in the lot?
- How will capacity be allocated for different vehicle types?
- If the parking spot of any vehicle type is booked, can a vehicle of another type park in the designated parking spot?
- How will pricing be handled? Should we accommodate having different rates for each hour? For example, customers will have to pay $4 for the first hour, $3.5 for the second and third hours, and  $2.5 for all the subsequent hours.
- Will the pricing be the same for the different vehicle types?


### Requirements

R1: The parking lot must support a total capacity of up to 40,000 vehicles.

R2: The parking lot must support multiple types of parking spots:
- Accessible (for individuals with disabilities)
- Compact
- Large
- Motorcycle

R3: The parking lot should provide multiple entrance and exit points to support efficient traffic flow.

R4: The system must support parking for four types of vehicles: cars, trucks, vans, and motorcycles.

R5: A display board at each entrance and on every floor should show the current number of available parking spots for each parking spot type.

R6: The system must not allow more vehicles to enter once the parking lot reaches its maximum capacity.

R7: When the parking lot is fully occupied, a clear message should be shown at each entrance and on all parking lot display boards.

R8: Customers must be issued a parking ticket at entry, which will be used to track parking time and calculate payment at exit.

R9: Customers should be able to pay for parking at the automated exit panel.

R10: The parking lot system must support configurable pricing rates based on vehicle type and/or parking spot type and different rates for different parking durations (e.g., first hour, subsequent hours).

R11: Payments must be accepted via credit/debit card and cash at all payment points.

### Code

#### Enumeration & Custom data type

```js

const PaymentStatus = Object.freeze({
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    PENDING: "PENDING",
    UNPAID: "UNPAID",
    REFUNDED: "REFUNDED"
});

const AccountStatus = Object.freeze({
    ACTIVE: "ACTIVE",
    CLOSED: "CLOSED",
    CANCELED: "CANCELED",
    BLACKLISTED: "BLACKLISTED",
    NONE: "NONE"
});

const TicketStatus = Object.freeze({
    ISSUED: "ISSUED",
    IN_USE: "IN_USE",
    PAID: "PAID",
    VALIDATED: "VALIDATED",
    CANCELED: "CANCELED",
    REFUNDED: "REFUNDED"
});

class Person {
    constructor() {
        this.name = undefined;
        this.address = undefined;
        this.phone = undefined;
        this.email = undefined;
    }
}

class Address {
    constructor() {
        this.zipCode = undefined;
        this.street = undefined;
        this.city = undefined;
        this.state = undefined;
        this.country = undefined;
    }
}
```

#### Parking spots

```js
class ParkingSpot {
    constructor() {
        this.id = undefined;
        this.isFree = undefined;
        this.vehicle = undefined; // Association: Each spot can be assigned to one vehicle
    }

    assignVehicle(vehicle) { /* abstract */ }
    removeVehicle() { /* Logic to remove vehicle from spot and mark as free */ return true; }
}

class Handicapped extends ParkingSpot {
    assignVehicle(vehicle) { /* ... */ return true; }
}

class Compact extends ParkingSpot {
    assignVehicle(vehicle) { /* ... */ return true; }
}

class Large extends ParkingSpot {
    assignVehicle(vehicle) { /* ... */ return true; }
}

class MotorcycleSpot extends ParkingSpot {
    assignVehicle(vehicle) { /* ... */ return true; }
}

```

#### Vehicle

```js
class Vehicle {
    constructor() {
        this.licenseNo = undefined;
        this.ticket = undefined; // Association: Each vehicle has a ticket
    }

    assignTicket(ticket) { /* abstract */ }
}

class Car extends Vehicle {
    assignTicket(ticket) { /* ... */ }
}

class Van extends Vehicle {
    assignTicket(ticket) { /* ... */ }
}

class Truck extends Vehicle {
    assignTicket(ticket) { /* ... */ }
}

class Motorcycle extends Vehicle {
    assignTicket(ticket) { /* ... */ }
}
```

#### Account

```js
class Account {
    constructor() {
        this.userName = undefined;
        this.password = undefined;
        this.person = undefined;
        this.status = undefined; // AccountStatus
    }

    resetPassword() { /* abstract */ }
}

class Admin extends Account {
    addParkingSpot(spot) { /* ... */ return true; }
    addDisplayBoard(board) { /* ... */ return true; }
    addEntrance(entrance) { /* ... */ return true; }
    addExit(exitObj) { /* ... */ return true; }
    resetPassword() { /* ... */ return true; }
}
```

#### Display board and parking rate

```js
class DisplayBoard {
    constructor(id) {
        this.id = id;
        this.parkingSpots = undefined; // Map: type -> list of ParkingSpot
    }

    addParkingSpot(spotType, spots) { /* ... */ }
    showFreeSlot() { /* ... */ }
}

class ParkingRate {
    constructor() {
        this.hours = undefined;
        this.rate = undefined;
    }

    calculate(duration, vehicle, spot) {
        // Pricing logic can use duration, vehicle type, spot type, etc.
        return 0.0;
    }
}
```

#### Entrance and Exit

```js
class Entrance {
    constructor() {
        this.id = undefined;
    }

    getTicket(vehicle) { /* ... */ return null; }
}

class Exit {
    constructor() {
        this.id = undefined;
    }

    validateTicket(ticket) { /* ... */ }
}
```

#### Parking ticket

```js
class ParkingTicket {
    constructor() {
        this.ticketNo = undefined;
        this.entryTime = undefined;
        this.exitTime = undefined;
        this.amount = undefined;
        this.status = undefined; // TicketStatus

        this.vehicle = undefined;
        this.payment = undefined; // Composition: Ticket owns Payment
        this.entrance = undefined;
        this.exitIns = undefined;
    }
}
```

#### Payment

```js
class Payment {
    constructor() {
        this.amount = undefined;
        this.status = undefined; // PaymentStatus
        this.timestamp = undefined;
    }

    initiateTransaction() { /* abstract */ }
}

class Cash extends Payment {
    initiateTransaction() { /* ... */ return true; }
}

class CreditCard extends Payment {
    initiateTransaction() { /* ... */ return true; }
}
```

#### Parking lot

```js
class ParkingLot {
    constructor() {
        this.id = undefined;
        this.name = undefined;
        this.address = undefined;
        this.parkingRate = undefined;

        this.entrances = undefined;    // Map: string -> Entrance
        this.exits = undefined;        // Map: string -> Exit
        this.spots = undefined;        // Map: int -> ParkingSpot
        this.tickets = undefined;      // Map: string -> ParkingTicket
        this.displayBoards = undefined; // List of DisplayBoard
    }

    // Singleton implementation
    static getInstance() {
        // ...
    }

    addEntrance(entrance) { /* ... */ return true; }
    addExit(exit) { /* ... */ return true; }
    addParkingSpot(spot) { /* ... */ return true; }
    addDisplayBoard(board) { /* ... */ return true; }

    getParkingTicket(vehicle) { /* ... */ return null; }
    isFull(spotType) { /* ... */ return false; }
}
```

## Executable code

```js
import { Handicapped } from './Handicapped.js';
import { Compact } from './Compact.js';
import { Large } from './Large.js';
import { MotorcycleSpot } from './MotorcycleSpot.js';
import { DisplayBoard } from './DisplayBoard.js';
import { Entrance } from './Entrance.js';
import { Exit } from './Exit.js';
import { Car } from './Car.js';
import { Van } from './Van.js';
import { Truck } from './Truck.js';
import { Motorcycle } from './Motorcycle.js';
import { ParkingLot } from './ParkingLot.js';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    console.log("\n====================== PARKING LOT SYSTEM DEMO ======================\n");

    const lot = ParkingLot.getInstance();
    lot.addSpot(new Handicapped(1));
    lot.addSpot(new Compact(2));
    lot.addSpot(new Large(3));
    lot.addSpot(new MotorcycleSpot(4));

    const board = new DisplayBoard(1);
    lot.addDisplayBoard(board);

    const entrance = new Entrance(1);
    const exitPanel = new Exit(1);

    // Scenario 1: Customer enters and parks
    console.log("\n→→→ SCENARIO 1: Customer enters and parks a car\n");
    const car = new Car("KA-01-HH-1234");
    console.log("-> Car " + car.licenseNo + " arrives at entrance");
    const ticket1 = entrance.getTicket(car);

    console.log("-> Updating display board after parking:");
    board.update(lot.getAllSpots());
    board.showFreeSlot();

    // Scenario 2: Customer exits and pays
    console.log("\n→→→ SCENARIO 2: Customer exits and pays\n");
    console.log("-> Car " + car.licenseNo + " proceeds to exit panel");
    await sleep(1500); // Simulate parking duration (1.5 sec)
    exitPanel.validateTicket(ticket1);

    console.log("-> Updating display board after exit:");
    board.update(lot.getAllSpots());
    board.showFreeSlot();

    // Scenario 3: Filling lot and rejecting entry if full
    console.log("\n→→→ SCENARIO 3: Multiple customers attempt to enter; lot may become full\n");
    const van = new Van("KA-01-HH-9999");
    const motorcycle = new Motorcycle("KA-02-XX-3333");
    const truck = new Truck("KA-04-AA-9998");
    const car2 = new Car("DL-09-YY-1234");

    console.log("-> Van " + van.licenseNo + " arrives at entrance");
    const ticket2 = entrance.getTicket(van);

    console.log("-> Motorcycle " + motorcycle.licenseNo + " arrives at entrance");
    const ticket3 = entrance.getTicket(motorcycle);

    console.log("-> Truck " + truck.licenseNo + " arrives at entrance");
    const ticket4 = entrance.getTicket(truck);

    console.log("-> Car " + car2.licenseNo + " arrives at entrance");
    const ticket5 = entrance.getTicket(car2);

    console.log("-> Updating display board after several parkings:");
    board.update(lot.getAllSpots());
    board.showFreeSlot();

    // Try to park another car (lot may now be full)
    const car3 = new Car("UP-01-CC-1001");
    console.log("-> Car " + car3.licenseNo + " attempts to park (should be denied if lot is full):");
    const ticket6 = entrance.getTicket(car3);

    board.update(lot.getAllSpots());
    board.showFreeSlot();

    console.log("\n====================== END OF DEMONSTRATION ======================\n");
}

// Only export main for optional use elsewhere
export { main };

main();
```