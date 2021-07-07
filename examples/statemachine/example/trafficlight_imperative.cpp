#include <iostream>
#include <typeinfo>
#include <map>
using namespace std;

enum Event {Next, SwitchCapacity};
map<Event, string> event_to_str = {
    {Next, "Next"},
    {SwitchCapacity, "SwitchCapacity"},
};
map<string, Event> str_to_event = {
    {"Next", Next},
    {"SwitchCapacity", SwitchCapacity},
};

enum State{PowerOff, RedLight, YellowLight, GreenLight};
map<State, string> state_to_str = {
    {PowerOff, "PowerOff"},
    {RedLight, "RedLight"},
    {YellowLight, "YellowLight"},
    {GreenLight, "GreenLight"},
};

map<State, map<Event, State>> statemachine;

void print_statemachine() {
    for (auto state_data : statemachine) {
        cout << state_to_str[state_data.first] << " :: " << endl;
        for (auto event_to_state : state_data.second) {
            cout << "    " << event_to_str[event_to_state.first] << " -> " << state_to_str[event_to_state.second] << endl;
        }
    }
}

void initiate_statemachine() {
    statemachine[PowerOff] = {
        {SwitchCapacity, RedLight},
    };
    statemachine[RedLight] = {
        {Next, GreenLight},
        {SwitchCapacity, PowerOff},
    };
    statemachine[YellowLight] = {
        {Next, RedLight},
        {SwitchCapacity, PowerOff},
    };
    statemachine[GreenLight] = {
        {Next, YellowLight},
        {SwitchCapacity, PowerOff},
    };
}


int main() {
    initiate_statemachine();
    print_statemachine();
    
    cout << "------------------------------------" << endl;

    State curr_state = PowerOff;
    cout << "Your current state is " << state_to_str[curr_state] << "." << endl;

    cout << "------------------------------------" << endl;

	for (string input; getline(cin, input);) {
	    map<string, Event>::const_iterator event_it = str_to_event.find(input);
	    if (event_it == str_to_event.end()) {
            cout << "Event " << input << " is not determined for the statemachine." << endl;
            continue;
	    }
	    Event event = event_it->second;
	    
	    // curr_state contains only existing State
	    map<Event, State> event_to_state = statemachine.find(curr_state)->second;
	    map<Event, State>::const_iterator event_to_state_it = event_to_state.find(event);
	    if (event_to_state_it == event_to_state.end()) {
	        cout << "There is no event " << input << " for the state " << state_to_str[curr_state] << "." << endl;
	        continue;
	    }
	    State new_state = event_to_state_it->second;

        cout << "New state is " << state_to_str[new_state] << "." << endl;
        curr_state = new_state;
	}

    return 0;
}