package main

import (
    "fmt"
    "reflect"
    "github.com/tormoder/fit"
)

func main() {
    rec := fit.RecordMsg{}
    lap := fit.LapMsg{}
    
    fmt.Println("Record fields:")
    t := reflect.TypeOf(rec)
    for i := 0; i < t.NumField(); i++ {
        fmt.Println(t.Field(i).Name)
    }

    fmt.Println("\nLap fields:")
    t = reflect.TypeOf(lap)
    for i := 0; i < t.NumField(); i++ {
        fmt.Println(t.Field(i).Name)
    }
}
